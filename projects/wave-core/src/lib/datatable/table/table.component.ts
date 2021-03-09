import {BehaviorSubject, combineLatest as observableCombineLatest, Observable, of as observableOf, Subscription} from 'rxjs';
import {map, switchMap} from 'rxjs/operators';

import {
    AfterViewInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    ElementRef,
    Input,
    OnChanges,
    OnDestroy,
    OnInit,
    SimpleChanges,
    ViewChild,
} from '@angular/core';
import {DataSource} from '@angular/cdk/collections';
import {MediaviewComponent} from '../mediaview/mediaview.component';
import {LayerService} from '../../layers/layer.service';
import {LoadingState} from '../../project/loading-state.model';
import {ResultTypes} from '../../operators/result-type.model';
import {Layer, VectorData, VectorLayer} from '../../layers/layer.model';
import {AbstractVectorSymbology} from '../../layers/symbology/symbology.model';
import {FeatureID} from '../../queries/geojson.model';
import {MapService} from '../../map/map.service';
import {ProjectService} from '../../project/project.service';
import {Unit} from '../../operators/unit.model';
import {Feature as OlFeature} from 'ol/Feature';
import {Point as OlPoint} from 'ol/geom/Point';

/**
 * Data-Table-Component
 * Displays a Data-Table
 */
@Component({
    selector: 'wave-datatable',
    templateUrl: './table.component.html',
    styleUrls: ['table.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
/**
 * Data-Table-Component
 * Displays a Data-Table
 */
export class TableComponent implements OnInit, OnChanges, OnDestroy, AfterViewInit {
    public LoadingState = LoadingState;

    @Input()
    public height: number;

    // Data and Data-Subsets
    public data: Array<{id: string | number; properties: {[key: string]: any}}>;
    public tableData: TableDataSource;
    public dataHead: Array<string>;
    public tableDataHead: Array<string>;
    public dataHeadUnits: Array<string>;

    // For row-selection
    public selected: boolean[];
    public allSelected: boolean;
    public allEqual: boolean;

    // Element-References
    @ViewChild('scrollContainer', {static: true}) public container: ElementRef;

    public data$: Observable<Array<OlFeature>>;
    public state$: Observable<LoadingState>;

    public offsetTop$: BehaviorSubject<number>;
    public offsetBottom$: BehaviorSubject<number>;

    public avgWidths: number[];
    public colTypes: string[];

    // For virtual scrolling
    public scrollTop = 0;
    public scrollLeft = 0;

    public displayItemCount: number;

    public displayItemCounter: number[];

    public firstDisplay: number;

    private displayOffsetMin = 1;

    private scrolling = false;

    private scrollTopBefore = 0;

    private elementHeight = 41;
    private headerHeight = 41;

    private minDisplayItemCount = 6;

    private selectable$: Observable<boolean>;
    private dataSubscription: Subscription;
    private featureSubscription: Subscription;

    // For text-width-calculation
    private styleString = '16px Roboto, sans-serif';
    private styleStringHead = '12px Roboto, sans-serif';
    private columnMinWidth = 100;
    private columnMaxWidth = 400;
    private canvas;

    /**
     * Returns all the keys of an object as array
     * @param object the object containing the keys
     * @returns {string[]} a string-array containing all the keys
     */
    private static getArrayOfKeys(object: {[key: string]: any}): Array<string> {
        return Object.keys(object).filter((x) => !(x.startsWith('___') || x === 'geometry'));
    }

    /**
     * Checks if the given unit is the default unit. If so returns an empty string, if not returns the unit formated for the header
     * @param x the unit to display
     * @returns {string} the formated unit-string
     */
    private static formatUnits(x: Unit): string {
        if (x && x.unit !== Unit.defaultUnit.unit) {
            return ' [' + x.unit + ']';
        } else {
            return '';
        }
    }

    /**
     * Sets up all variables
     * Extracts the column names from the data input and calculates the average widths of all rows
     * @param cdr ChangeDetector Reference
     * @param layerService LayerService Reference
     * @param mapService MapService Reference
     * @param projectService ProjectService Reference
     */
    constructor(
        private cdr: ChangeDetectorRef,
        public layerService: LayerService,
        private mapService: MapService,
        private projectService: ProjectService,
    ) {
        this.canvas = document.createElement('canvas');

        this.displayItemCount = this.minDisplayItemCount;

        this.initDataStream();
    }

    ngOnInit() {
        this.dataSubscription = this.data$.subscribe((features: Array<OlFeature>) => {
            this.dataHead = [];
            this.dataHeadUnits = [];
            this.tableDataHead = [];

            this.data = features.map((x) => {
                return {
                    id: x.getId(),
                    properties: x.getProperties(),
                };
            });

            if (this.height / this.elementHeight > this.minDisplayItemCount) {
                this.displayItemCount = Math.ceil((1.5 * this.height) / this.elementHeight);
            }

            // console.log(this.data);

            // only needs to be called once for each "data"
            this.dataInit();

            this.cdr.markForCheck();
        });
    }

    /**
     * Get the height of the container and save it to variable
     */
    ngAfterViewInit() {
        this.featureSubscription = this.layerService.getSelectedFeaturesStream().subscribe((x) => {
            for (let i = 0; i < this.data.length; i++) {
                const selectedContainsId = x.selected.contains(this.data[i].id);
                if (!this.selected[i] && selectedContainsId) {
                    this.container.nativeElement.scrollTop = i * this.elementHeight;
                }

                this.selected[i] = selectedContainsId;
            }

            this.testSelected();
            this.testEqual();

            this.cdr.markForCheck();
        });
    }

    ngOnChanges(changes: SimpleChanges) {
        if (this.height / this.elementHeight > this.minDisplayItemCount) {
            this.displayItemCount = Math.ceil((1.5 * this.height) / this.elementHeight);
        }
    }

    ngOnDestroy() {
        this.dataSubscription.unsubscribe();
        this.featureSubscription.unsubscribe();
    }

    private initDataStream(): void {
        const dataStream: Observable<{
            data$: Observable<OlFeature[]>;
            state$: Observable<LoadingState>;
            selectable: boolean;
        }> = this.layerService.getSelectedLayerStream().pipe(
            map((layer) => {
                if (layer instanceof Layer) {
                    switch (layer.operator.resultType) {
                        case ResultTypes.POINTS:
                        case ResultTypes.LINES:
                        case ResultTypes.POLYGONS:
                            let vectorLayer = layer as VectorLayer<AbstractVectorSymbology>;
                            let vectorLayerData = this.projectService.getLayerDataStream(vectorLayer) as Observable<VectorData>;

                            const data = observableCombineLatest(vectorLayerData, this.mapService.getViewportSizeStream()).pipe(
                                map(([d, v]) => {
                                    return d.data.filter((x) => {
                                        const ve = v.extent;

                                        // console.log(ve, x.getGeometry(), int);
                                        return (x.getGeometry() as OlPoint).intersectsExtent(ve); // TODO: not only point
                                    });
                                }),
                            );
                            return {
                                data$: data,
                                dataExtent$: vectorLayerData.pipe(map((x) => x.extent)),
                                state$: this.projectService.getLayerDataStatusStream(vectorLayer),
                                selectable: true,
                            };
                        default:
                            return {
                                data$: observableOf([]),
                                state$: observableOf(LoadingState.OK),
                                selectable: false,
                            };
                    }
                } else {
                    return {
                        data$: observableOf([]),
                        state$: observableOf(LoadingState.OK),
                        selectable: false,
                    };
                }
            }),
        );

        // FIXME: use the correct datatype?
        this.data$ = dataStream.pipe(switchMap((stream) => stream.data$));
        this.state$ = dataStream.pipe(switchMap((stream) => stream.state$));
        this.selectable$ = dataStream.pipe(map((stream) => stream.selectable));
    }

    /**
     * Called when the input-variable data has changed
     * Resets and recalculates all variables needed for displaying data in the table, virtual scrolling and selection
     */
    private dataInit(): void {
        this.firstDisplay = 0;

        this.tableData = new TableDataSource(this.data, this.firstDisplay, this.displayItemCount);

        this.container.nativeElement.scrollTop = 0;
        this.container.nativeElement.scrollLeft = 0;

        this.offsetTop$ = new BehaviorSubject(0);
        let offsetBottom = (this.data.length - this.displayItemCount) * this.elementHeight;
        if (offsetBottom < 0) {
            offsetBottom = 0;
        }
        this.offsetBottom$ = new BehaviorSubject(offsetBottom);

        // Reset selection
        this.selected = [];
        for (let i = 0; i < this.data.length; i++) {
            this.selected[i] = false;
        }

        // Get Header
        if (this.data.length > 0 && this.data[0].properties) {
            this.dataHead = TableComponent.getArrayOfKeys(this.data[0].properties);
            this.tableDataHead = ['selection', ...this.dataHead];
        }

        // console.log(this.dataHead);
        if (this.layerService) {
            if (this.layerService.getSelectedLayer()) {
                let units = this.layerService.getSelectedLayer().operator.units;

                if (units) {
                    this.dataHeadUnits = [];

                    for (let d in this.dataHead) {
                        if (this.dataHead.hasOwnProperty(d)) {
                            this.dataHeadUnits.push(this.dataHead[d] + TableComponent.formatUnits(units.get(this.dataHead[d])));
                        }
                    }
                }
            }
        }

        // Reset avg widths
        this.avgWidths = [];
        for (let i = 0; i < this.data.length; i++) {
            this.avgWidths[i] = this.columnMinWidth;
        }

        // Calculate Column widths
        const testData = this.selectRandomSubData(20);
        [this.avgWidths, this.colTypes] = this.calculateColumnProperties(testData, this.dataHead, this.dataHeadUnits);

        /*console.log('--------------------------------');
        console.log(testData);
        console.log(this.avgWidths);*/

        // Recreate displayItemCounter
        this.displayItemCounter = [];
        let j = 0;
        while (this.displayItemCounter.length < this.displayItemCount && this.displayItemCounter.length < this.data.length) {
            this.displayItemCounter.push(j);
            j++;
        }

        // Test for Selections
        this.testSelected();
        this.testEqual();
    }

    /**
     * Uses canvas.measureText to compute and return the width of the given text of given font in pixels.
     *
     * @param {String} text The text to be rendered.
     * @param {String} font The css font descriptor that text is to be rendered with (e.g. "bold 14px verdana").
     * @returns {number} the calculated width
     */
    private getTextWidth(text, font): number {
        // re-use canvas object for better performance
        let context = this.canvas.getContext('2d');
        context.font = font;
        let metrics = context.measureText(text);
        // console.log(metrics);
        return metrics.width;
    }

    /**
     * Selects a given number of random rows from the main dataset
     * @param number amount of rows to select
     * @returns {Array} an array of rows from the dataset
     */
    private selectRandomSubData(number): Array<any> {
        let testData = [];

        for (let i = 0; i < number; i++) {
            let r = Math.floor(Math.random() * this.data.length);

            testData[i] = this.data[r];
        }

        return testData;
    }

    /**
     * Calculates the average column-text-widths of a given dataset. Also includes the header-texts to make shure they also fit
     * Tests for the contents of the sample-data to predict the content type of each column
     * @param testData the dataset, to calculate column widths from
     * @param dataHead the column names of the given dataset
     * @param dataHeadUnits the column names of the given dataset (with units)
     * @returns ({Array},{Array}) an array of average-widths and an array with the predicted content types
     */
    private calculateColumnProperties(testData, dataHead, dataHeadUnits): [number[], string[]] {
        let headCount = dataHead.length;

        let widths = [];
        let types = [];

        for (let column = 0; column < headCount; column++) {
            let columnWidth = 0;
            let columnType;

            // Header Row
            columnWidth = this.getTextWidth(dataHeadUnits[column], this.styleStringHead);

            columnType = 'text';

            for (let row = 0; row < testData.length; row++) {
                // Normal Table Rows
                let tmp = testData[row].properties[dataHead[column]];

                // console.log(tmp);

                if (typeof tmp === 'string' && tmp !== '') {
                    let urls = tmp.split(/(,)/g);

                    let mediaCount = [0, 0, 0];
                    let nonUrlsString = '';

                    for (let u in urls) {
                        if (urls.hasOwnProperty(u)) {
                            let mediaType = MediaviewComponent.getType(urls[u]);

                            if (mediaType !== '') {
                                if (mediaType === 'text') {
                                    nonUrlsString += urls[u] + ' ';
                                } else {
                                    if (mediaType === 'image') {
                                        mediaCount[0] += 1;
                                    } else if (mediaType === 'audio') {
                                        mediaCount[1] += 1;
                                    } else if (mediaType === 'video') {
                                        mediaCount[2] += 1;
                                    }

                                    columnType = 'media';
                                }
                            }
                        }
                    }

                    let mediaString = '';

                    if (mediaCount[0] > 0) {
                        mediaString += '___ ' + mediaCount[0] + ' images';
                    }
                    if (mediaCount[1] > 0) {
                        mediaString += '___ ' + mediaCount[1] + ' audio-files';
                    }
                    if (mediaCount[2] > 0) {
                        mediaString += '___ ' + mediaCount[2] + ' videos';
                    }

                    mediaString += ' ' + nonUrlsString;

                    // console.log(mediaString);

                    columnWidth = Math.max(columnWidth, this.getTextWidth(mediaString, this.styleString));
                }
            }

            // Widths
            if (columnWidth > this.columnMaxWidth) {
                columnWidth = this.columnMaxWidth;
            }
            widths[column] = columnWidth;

            // Types
            types[column] = columnType;
        }

        return [widths, types];
    }

    /**
     * Called on Scrolling the Data-Table
     * Updates the auto-scrolling first row and first column and calls the virtual-scroll update functions (top and bottom)
     */
    public updateScroll(): void {
        this.scrollTopBefore = this.scrollTop;
        // this.scrollLeftBefore = this.scrollLeft;

        this.scrollTop = this.container.nativeElement.scrollTop;
        this.scrollLeft = this.container.nativeElement.scrollLeft;
        // console.log(this.scrollTopBefore+"->"+this.scrollTop);

        if (this.data != null && !this.scrolling) {
            this.scrolling = true;

            let numberOfTopRows;

            // Scrolling down
            if (this.scrollTop > this.scrollTopBefore) {
                if (
                    this.scrollTop + this.height >
                    this.headerHeight + (this.firstDisplay + this.displayItemCount - this.displayOffsetMin) * this.elementHeight
                ) {
                    numberOfTopRows = Math.floor((this.scrollTop - this.headerHeight) / this.elementHeight) - this.displayOffsetMin;
                }
            }

            // Scrolling up
            if (this.scrollTop < this.scrollTopBefore) {
                if (this.scrollTop < this.headerHeight + (this.firstDisplay + this.displayOffsetMin) * this.elementHeight) {
                    numberOfTopRows =
                        Math.floor((this.scrollTop + this.height) / this.elementHeight) + this.displayOffsetMin - this.displayItemCount;
                }
            }

            if (typeof numberOfTopRows !== 'undefined') {
                if (numberOfTopRows + this.displayItemCount > this.data.length) {
                    numberOfTopRows = this.data.length - this.displayItemCount;
                }
                if (numberOfTopRows < 0) {
                    numberOfTopRows = 0;
                }

                if (this.firstDisplay !== numberOfTopRows) {
                    this.firstDisplay = numberOfTopRows;
                    this.tableData.update(this.data, this.firstDisplay, this.displayItemCount);

                    this.offsetBottom$.next((this.data.length - numberOfTopRows - this.displayItemCount) * this.elementHeight);
                    this.offsetTop$.next(numberOfTopRows * this.elementHeight);
                }
            }

            this.scrolling = false;
        }
    }

    /**
     * Row-Selection
     * Called on clicking a checkbox to select a row
     * toggles the checked-variable for this row and runs the tests to check, whether all rows are selected or unselected
     */
    public toggle(index: number): void {
        this.selected[index] = !this.selected[index];

        if (this.selected[index]) {
            this.layerService.updateSelectedFeatures([this.data[index].id], []);
        } else {
            this.layerService.updateSelectedFeatures([], [this.data[index].id]);
        }
    }

    /**
     * Row-Selection
     * Called when clicking the select-all-checkbox
     * Selects or unselects all rows, depending on whether a row is already selected
     */
    public toggleAll(): void {
        let toggledList = Array<FeatureID>();
        for (let i = 0; i < this.selected.length; i++) {
            if (this.allSelected === this.selected[i]) {
                toggledList.push(this.data[i].id);
            }

            this.selected[i] = !this.allSelected;
        }

        if (!this.allSelected) {
            this.layerService.updateSelectedFeatures(toggledList, []);
        } else {
            this.layerService.updateSelectedFeatures([], toggledList);
        }
    }

    /**
     * Row-Selection
     * Tests, if all Rows are selected and sets the global allSelected variable
     * Also emits the row-selection-event
     */
    private testSelected(): void {
        this.allSelected = true;
        for (let s of this.selected) {
            if (!s) {
                this.allSelected = false;
                break;
            }
        }
    }

    /**
     * Row-Selection
     * Tests, if all Rows are in equal state (all selected or all unselected) and sets the global allEqual variable
     */
    private testEqual(): void {
        this.allEqual = true;
        for (let s of this.selected) {
            if (s !== this.selected[0]) {
                this.allEqual = false;
                break;
            }
        }
    }
}

export class TableDataSource extends DataSource<any> {
    private dataObs$: BehaviorSubject<Element[]>;

    constructor(data: Array<any>, start: number, length: number) {
        super();
        this.dataObs$ = new BehaviorSubject([]);
        this.update(data, start, length);
    }

    update(data: Array<any>, start: number, length: number): void {
        let slice = data.slice(start, start + length);
        let dataNew = [undefined, ...slice, undefined];
        // console.log(start, length);
        // console.log(this.data);
        this.dataObs$.next(dataNew);
    }

    /** Connect function called by the table to retrieve one stream containing the data to render. */
    connect(): Observable<Element[]> {
        return this.dataObs$.asObservable();
    }

    disconnect() {}
}
