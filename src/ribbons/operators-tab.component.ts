import {
    Component, Input, ChangeDetectionStrategy, ElementRef, ViewChildren,
    QueryList, AfterViewInit, ChangeDetectorRef, ViewChild,
} from '@angular/core';
import {CORE_DIRECTIVES} from '@angular/common';

import {Observable} from 'rxjs/Rx';

import {MATERIAL_DIRECTIVES} from 'ng2-material';

import {OperatorButtonComponent, OperatorSelectionGroupComponent}
  from './operator-selection-group.component';

import {LayerService} from '../services/layer.service';
import {PlotService} from '../plots/plot.service';
import {ProjectService} from '../services/project.service';
import {MappingQueryService} from '../services/mapping-query.service';
import {RandomColorService} from '../services/random-color.service';

import {RasterValueExtractionType} from '../operators/types/raster-value-extraction-type.model';
import {NumericAttributeFilterType} from '../operators/types/numeric-attribute-filter-type.model';
import {PointInPolygonFilterType} from '../operators/types/point-in-polygon-filter-type.model';
import {ExpressionType} from '../operators/types/expression-type.model';
import {HistogramType} from '../operators/types/histogram-type.model';
import {RScriptType} from '../operators/types/r-script-type.model';
import {
    MsgRadianceType, MsgReflectanceType,
    MsgSolarangleType, MsgTemperatureType,
    MsgPansharpenType, MsgCo2CorrectionType,
} from '../operators/types/msg-types.model';

import {DialogLoaderComponent} from '../dialogs/dialog-loader.component';
import {RasterValueExtractionOperatorComponent}
  from '../operators/dialogs/raster-value-extraction.component';
import {NumericAttributeFilterOperatorComponent}
  from '../operators/dialogs/numeric-attribute-filter.component';
import {PointInPolygonFilterOperatorComponent}
  from '../operators/dialogs/point-in-polygon-filter.component';
import {ExpressionOperatorComponent} from '../operators/dialogs/expression-operator.component';
import {HistogramOperatorComponent} from '../operators/dialogs/histogram.component';
// import {ROperatorComponent} from '../operators/dialogs/r-operator.component';
// import {
//     MsgRadianceOperatorComponent, MsgReflectanceOperatorComponent,
//     MsgSolarangleOperatorComponent, MsgTemperatureOperatorComponent,
//     MsgPansharpenOperatorComponent, MsgCo2CorrectionOperatorComponent,
// } from '../operators/dialogs/msg-operators.component';

/**
 * The operator tab of the ribbons component.
 */
@Component({
    selector: 'wave-operators-tab',
    template: `
    <div #container layout="row">
        <wave-operator-selection-group groupName="Vector" [smallButtons]="smallButtons">
            <wave-operator-button [small]="smallButtons"
                [text]="RasterValueExtractionType.NAME"
                [iconUrl]="RasterValueExtractionType.ICON_URL"
                (click)="rasterValueExtractionOperatorDialog.show()">
            </wave-operator-button>
            <wave-operator-button [small]="smallButtons"
                [text]="NumericAttributeFilterType.NAME"
                [iconUrl]="NumericAttributeFilterType.ICON_URL"
                (click)="numericAttributeFilterOperatorDialog.show()">
            </wave-operator-button>
            <wave-operator-button [small]="smallButtons"
                [text]="PointInPolygonFilterType.NAME"
                [iconUrl]="PointInPolygonFilterType.ICON_URL"
                (click)="pointInPolygonFilterOperatorDialog.show()">
            </wave-operator-button>
        </wave-operator-selection-group>
        <wave-operator-selection-group groupName="Raster" [smallButtons]="smallButtons">
            <wave-operator-button [small]="smallButtons"
                [text]="ExpressionType.NAME"
                [iconUrl]="ExpressionType.ICON_URL"
                (click)="expressionOperatorDialog.show()">
            </wave-operator-button>
        </wave-operator-selection-group>
        <wave-operator-selection-group groupName="Plots" [smallButtons]="smallButtons">
            <wave-operator-button [small]="smallButtons"
                [text]="HistogramType.NAME"
                [iconUrl]="HistogramType.ICON_URL"
                (click)="histogramOperatorDialog.show()">
            </wave-operator-button>
        </wave-operator-selection-group>
        <wave-operator-selection-group groupName="Misc" [smallButtons]="smallButtons">
            <wave-operator-button [small]="smallButtons"
                [text]="RScriptType.NAME"
                [iconUrl]="RScriptType.ICON_URL"
                (click)="addROperator()">
            </wave-operator-button>
        </wave-operator-selection-group>
        <wave-operator-selection-group groupName="MSG" [smallButtons]="smallButtons">
            <wave-operator-button [small]="smallButtons"
                [text]="MsgRadianceType.NAME"
                [iconUrl]="MsgRadianceType.ICON_URL"
                (click)="addMsgRadianceOperator()">
            </wave-operator-button>
            <wave-operator-button [small]="smallButtons"
                [text]="MsgReflectanceType.NAME"
                [iconUrl]="MsgReflectanceType.ICON_URL"
                (click)="addMsgReflectanceOperator()">
            </wave-operator-button>
            <wave-operator-button [small]="smallButtons"
                [text]="MsgSolarangleType.NAME"
                [iconUrl]="MsgSolarangleType.ICON_URL"
                (click)="addMsgSolarangleOperator()">
            </wave-operator-button>
            <wave-operator-button [small]="smallButtons"
                [text]="MsgTemperatureType.NAME"
                [iconUrl]="MsgTemperatureType.ICON_URL"
                (click)="addMsgTemperatureOperator()">
            </wave-operator-button>
            <wave-operator-button [small]="smallButtons"
                [text]="MsgPansharpenType.NAME"
                [iconUrl]="MsgPansharpenType.ICON_URL"
                (click)="addMsgPansharpenOperator()">
            </wave-operator-button>
            <wave-operator-button [small]="smallButtons"
                [text]="MsgCo2CorrectionType.NAME"
                [iconUrl]="MsgCo2CorrectionType.ICON_URL"
                (click)="addMsgCo2CorrectionOperator()">
            </wave-operator-button>
        </wave-operator-selection-group>
    </div>
    <wave-dialog-loader #rasterValueExtractionOperatorDialog
        [type]="RasterValueExtractionOperatorComponent"
    ></wave-dialog-loader>
    <wave-dialog-loader #numericAttributeFilterOperatorDialog
        [type]="NumericAttributeFilterOperatorComponent"
    ></wave-dialog-loader>
    <wave-dialog-loader #pointInPolygonFilterOperatorDialog
        [type]="PointInPolygonFilterOperatorComponent"
    ></wave-dialog-loader>
    <wave-dialog-loader #expressionOperatorDialog
        [type]="ExpressionOperatorComponent"
    ></wave-dialog-loader>
    <wave-dialog-loader #histogramOperatorDialog
        [type]="HistogramOperatorComponent"
    ></wave-dialog-loader>
    `,
    styles: [`
    fieldset {
        border-style: solid;
        border-width: 1px;
        padding: 0px;
    }
    fieldset .material-icons {
        vertical-align: middle;
    }
    fieldset [md-fab] .material-icons {
        vertical-align: baseline;
    }
    button {
        height: 36px;
    }
    button[disabled] {
        background-color: transparent;
    }
    `],
    directives: [
        CORE_DIRECTIVES, MATERIAL_DIRECTIVES, DialogLoaderComponent,
        OperatorSelectionGroupComponent, OperatorButtonComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperatorsTabComponent implements AfterViewInit {
    @ViewChildren(OperatorSelectionGroupComponent)
    groups: QueryList<OperatorSelectionGroupComponent>;

    @ViewChild('container') container: ElementRef;

    @Input() maxWidth: number;

    smallButtons = false;

    // make these types accessible in the view
    // tslint:disable:variable-name
    RasterValueExtractionType = RasterValueExtractionType;
    NumericAttributeFilterType = NumericAttributeFilterType;
    PointInPolygonFilterType = PointInPolygonFilterType;
    ExpressionType = ExpressionType;
    HistogramType = HistogramType;
    RScriptType = RScriptType;
    MsgRadianceType = MsgRadianceType;
    MsgReflectanceType = MsgReflectanceType;
    MsgSolarangleType = MsgSolarangleType;
    MsgTemperatureType = MsgTemperatureType;
    MsgPansharpenType = MsgPansharpenType;
    MsgCo2CorrectionType = MsgCo2CorrectionType;
    // tslint:enable

    // make these dialogs accessible in the view
    // tslint:disable:variable-name
    RasterValueExtractionOperatorComponent = RasterValueExtractionOperatorComponent;
    NumericAttributeFilterOperatorComponent = NumericAttributeFilterOperatorComponent;
    PointInPolygonFilterOperatorComponent = PointInPolygonFilterOperatorComponent;
    ExpressionOperatorComponent = ExpressionOperatorComponent;
    HistogramOperatorComponent = HistogramOperatorComponent;
    // tslint:enable

    constructor(
        private changeDetectorRef: ChangeDetectorRef,
        private layerService: LayerService,
        private plotService: PlotService,
        private projectService: ProjectService,
        private mappingQueryService: MappingQueryService,
        private randomColorService: RandomColorService
    ) {}

    ngAfterViewInit() {
        // recalculate the button group sizing on window resize
        Observable.fromEvent(window, 'resize')
                  .map(_ => this.container.nativeElement.clientWidth)
                  .subscribe(availabeWidth => {
                      this.setGroupSizeBasedOnMaxWidth(availabeWidth);
                  });

        // initially calculate the button group sizing
        setTimeout(() => this.setGroupSizeBasedOnMaxWidth(
            this.container.nativeElement.clientWidth)
        );
    }

    /**
     * This functions tries to find the maximum number of buttons to show incrementally.
     * It uses small buttons if a minimum value of visible buttons per group is reached.
     */
    private setGroupSizeBasedOnMaxWidth(availableWidth: number) {
        const minItemsPerGroup = 2;
        const maxItemsPerGroup = this.groups.reduce(
            (acc, group) => Math.max(acc, group.buttons.length),
            0
        );

        // try using large buttons
        this.groups.forEach(group => group.smallButtons = false);
        this.smallButtons = false;

        let itemsPerGroup = maxItemsPerGroup;
        let totalWidth: number;
        do {
            totalWidth = this.groups.reduce(
                (acc, group) => acc + group.getGroupWidth(itemsPerGroup),
                0
            );
            itemsPerGroup--;
        } while (
            totalWidth > availableWidth && itemsPerGroup >= minItemsPerGroup
        );

        if (totalWidth > availableWidth) {
            // use small buttons now
            this.groups.forEach(group => group.smallButtons = true);
            this.smallButtons = true;

            itemsPerGroup = maxItemsPerGroup; // reset to max
            do {
                totalWidth = this.groups.reduce(
                    (acc, group) => acc + group.getGroupWidth(itemsPerGroup),
                    0
                );
                itemsPerGroup--;
            } while (
                totalWidth > availableWidth && itemsPerGroup >= minItemsPerGroup
            );
        }

        // set the buttons for each group. +1 because of decrease in loop.
        this.groups.forEach(group => group.buttonsVisible = itemsPerGroup + 1);

        this.changeDetectorRef.markForCheck();
    }
}
