import {ChangeDetectionStrategy, Component, OnDestroy, OnInit} from '@angular/core';
import {FormControl, FormGroup, Validators} from '@angular/forms';
import {ResultTypes} from '../../result-type.model';
import {ProjectService} from '../../../project/project.service';
import {Layer, RasterLayer} from '../../../layers/layer.model';
import {MappingRasterSymbology, AbstractRasterSymbology, AbstractSymbology} from '../../../layers/symbology/symbology.model';
import {Interpolation, Unit} from '../../unit.model';
import {Operator} from '../../operator.model';
import {NotificationService} from '../../../notification.service';
import {DataType, DataTypes} from '../../datatype.model';
import {ColorizerData} from '../../../colors/colorizer-data.model';
import {ColorBreakpoint} from '../../../colors/color-breakpoint.model';
import {RgbaCompositeType} from '../../types/rgba-composite-type.model';
import {BehaviorSubject, Observable, Subscription} from 'rxjs';
import {MappingQueryService} from '../../../queries/mapping-query.service';
import {first, map} from 'rxjs/operators';
import {StatisticsType} from '../../types/statistics-type.model';
import {LayoutService} from '../../../layout.service';
import {WaveValidators} from '../../../util/form.validators';

/**
 * This dialog allows users to create an RGB composite out of multiple raster layers.
 */
@Component({
    selector: 'wave-create-rgb-composite',
    templateUrl: './rgb-composite.component.html',
    styleUrls: ['./rgb-composite.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RgbCompositeComponent implements OnInit, OnDestroy {
    readonly inputTypes = [ResultTypes.RASTER];
    readonly numberOfRasters = 3;
    readonly loadingSpinnerDiameter = 2 * LayoutService.remInPx;

    form: FormGroup;
    formIsInvalid$: Observable<boolean>;
    notAllLayersSet$: Observable<boolean>;
    isRasterStatsLoading$ = new BehaviorSubject(false);

    private inputLayersubscriptions: Subscription;

    /**
     * DI for several dependent services
     */
    constructor(
        private projectService: ProjectService,
        private notificationService: NotificationService,
        private mappingQueryService: MappingQueryService,
    ) {}

    ngOnInit() {
        this.form = new FormGroup({
            inputLayers: new FormControl(undefined, [
                Validators.required,
                Validators.minLength(this.numberOfRasters),
                Validators.maxLength(this.numberOfRasters),
            ]),
            redMin: new FormControl(undefined, [WaveValidators.isNumber]),
            redMax: new FormControl(undefined, [WaveValidators.isNumber]),
            redScale: new FormControl(1, [WaveValidators.isNumber, Validators.min(0), Validators.max(1)]),
            greenMin: new FormControl(undefined, [WaveValidators.isNumber]),
            greenMax: new FormControl(undefined, [WaveValidators.isNumber]),
            greenScale: new FormControl(1, [WaveValidators.isNumber, Validators.min(0), Validators.max(1)]),
            blueMin: new FormControl(undefined, [WaveValidators.isNumber]),
            blueMax: new FormControl(undefined, [WaveValidators.isNumber]),
            blueScale: new FormControl(1, [WaveValidators.isNumber, Validators.min(0), Validators.max(1)]),
        });

        this.formIsInvalid$ = this.form.statusChanges.pipe(map((status) => status !== 'VALID'));
        this.notAllLayersSet$ = this.form.controls['inputLayers'].valueChanges.pipe(
            map((value: Array<Layer<AbstractSymbology>>) => {
                return (
                    value === undefined ||
                    value === null ||
                    value.length !== 3 ||
                    value.some((layer) => layer === undefined || layer === null)
                );
            }),
        );

        this.inputLayersubscriptions = this.form.controls['inputLayers'].valueChanges.subscribe(
            (inputLayers: Array<RasterLayer<AbstractRasterSymbology>>) => {
                // set meaningful default values if possible
                const colors = ['red', 'green', 'blue'];
                inputLayers.forEach((inputRaster, i) => {
                    if (inputRaster && !this.form.controls[`${colors[i]}Min`].value) {
                        this.form.controls[`${colors[i]}Min`].setValue(inputLayers[i].operator.getDataType('value').getMin());
                    }
                    if (inputRaster && !this.form.controls[`${colors[i]}Max`].value) {
                        this.form.controls[`${colors[i]}Max`].setValue(inputLayers[i].operator.getDataType('value').getMax());
                    }
                });
            },
        );

        setTimeout(() => {
            // calculate validity to enforce invalid state upfront
            this.form.updateValueAndValidity();
            this.form.controls['inputLayers'].updateValueAndValidity();
        });
    }

    ngOnDestroy() {
        if (this.inputLayersubscriptions) {
            this.inputLayersubscriptions.unsubscribe();
        }
    }

    /**
     * Creates an RGB layer out of the user input and adds it to the map
     */
    add() {
        const inputs: Array<RasterLayer<AbstractRasterSymbology>> = this.form.controls['inputLayers'].value;
        const operators = inputs.map((layer) => layer.operator);

        if (inputs.length !== 3) {
            this.notificationService.error('RGBA calculation requires 3 inputs.');
            return;
        }

        // in case the operators have different projections, use projection of first one
        const projection = operators[0].projection;
        for (let i = 1; i < operators.length; ++i) {
            operators[i] = operators[i].getProjectedOperator(projection);
        }

        const unit = new Unit({
            interpolation: Interpolation.Unknown,
            measurement: 'unknown',
            unit: 'unknown',
            min: 1,
            max: 0xffffffff,
        });

        this.projectService.addLayer(
            new RasterLayer({
                name: `RGB of (${inputs.map((layer) => layer.name).join(', ')})`,
                operator: new Operator({
                    operatorType: new RgbaCompositeType({
                        rasterRedMin: this.form.controls['redMin'].value,
                        rasterRedMax: this.form.controls['redMax'].value,
                        rasterRedScale: this.form.controls['redScale'].value,
                        rasterGreenMin: this.form.controls['greenMin'].value,
                        rasterGreenMax: this.form.controls['greenMax'].value,
                        rasterGreenScale: this.form.controls['greenScale'].value,
                        rasterBlueMin: this.form.controls['blueMin'].value,
                        rasterBlueMax: this.form.controls['blueMax'].value,
                        rasterBlueScale: this.form.controls['blueScale'].value,
                    }),
                    projection,
                    rasterSources: operators,
                    resultType: ResultTypes.RASTER,
                    attributes: ['value'],
                    dataTypes: new Map<string, DataType>().set('value', DataTypes.UInt32),
                    units: new Map<string, Unit>().set('value', unit),
                }),
                symbology: MappingRasterSymbology.createSymbology({
                    unit,
                    colorizer: new ColorizerData({
                        breakpoints: [
                            new ColorBreakpoint({rgba: {r: 0, g: 0, b: 0, a: 0}, value: 0}),
                            new ColorBreakpoint({rgba: {r: 255, g: 255, b: 255, a: 255}, value: 0xffffffff}),
                        ],
                        type: 'rgba_composite',
                    }),
                }),
            }),
        );
    }

    /**
     * Creates on-the-fly a statistics operator for the raster and pastes the result to the
     * min/max input fields of the dialog
     */
    calculateRasterStats() {
        this.isRasterStatsLoading$.next(true);

        this.projectService
            .getTimeStream()
            .pipe(first())
            .subscribe((time) => {
                const inputs: Array<RasterLayer<AbstractRasterSymbology>> = this.form.controls['inputLayers'].value;
                const operators = inputs.map((layer) => layer.operator);

                const operatorA = operators[0];
                const projection = operatorA.projection;
                const operatorB = operators[1].getProjectedOperator(projection);
                const operatorC = operators[2].getProjectedOperator(projection);

                const operator = new Operator({
                    operatorType: new StatisticsType({
                        raster_width: 1024,
                        raster_height: 1024,
                    }),
                    projection,
                    rasterSources: [operatorA, operatorB, operatorC],
                    resultType: ResultTypes.PLOT,
                });

                this.mappingQueryService
                    .getPlotData({
                        extent: projection.getExtent(),
                        operator,
                        projection,
                        time,
                    })
                    .subscribe((result) => {
                        const rasterStatistics = ((result as any) as RasterStatisticsType).data.rasters;

                        ['red', 'green', 'blue'].forEach((color, i) => {
                            this.form.controls[`${color}Min`].setValue(rasterStatistics[i].min);
                            this.form.controls[`${color}Max`].setValue(rasterStatistics[i].max);
                        });

                        this.isRasterStatsLoading$.next(false);
                    });
            });
    }

    /**
     * Retrieves the min/max information of the units of the raster layers and
     * pastes the result to the min/max input fields of the dialog
     */
    retrieveRasterStatsFromUnit() {
        const operators: Array<Operator> = this.form.controls['inputLayers'].value.map((layer) => layer.operator);

        ['red', 'green', 'blue'].forEach((color, i) => {
            const unit = operators[i].units.get('value', Unit.defaultUnit);
            this.form.controls[`${color}Min`].setValue(unit.min);
            this.form.controls[`${color}Max`].setValue(unit.max);
        });
    }
}

/**
 * The result type of the raster statistics (plot) operator
 *
 * The results of tht rasters are returned in the same order of the query
 */
interface RasterStatisticsType {
    data: {
        rasters: Array<{
            count: number;
            max: number;
            mean: number;
            min: number;
            nan_count: number;
        }>;
    };
}
