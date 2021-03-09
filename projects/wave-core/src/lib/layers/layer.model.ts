import {Observable, Observer} from 'rxjs';

import {Operator, OperatorDict} from '../operators/operator.model';
import {
    AbstractSymbology,
    AbstractVectorSymbology,
    MappingRasterSymbology,
    AbstractRasterSymbology,
    SymbologyDict,
} from './symbology/symbology.model';
import {Provenance} from '../provenance/provenance.model';
import {LoadingState} from '../project/loading-state.model';
import {GeoJSON as OlFormatGeoJSON} from 'ol/format';
import {Feature as OlFeature} from 'ol/Feature';
import {ProjectionLike as OlProjectionLike} from 'ol/proj';
import {Time, TimePoint} from '../time/time.model';
import {Projection} from '../operators/projection.model';

export abstract class LayerData<D> {
    type: LayerType;
    _time: Time;
    _projection: Projection;

    protected constructor(type: LayerType, time: Time, projection: Projection) {
        this.type = type;
        this._projection = projection;
        this._time = time;
    }

    get time(): Time {
        return this._time;
    }

    get projection(): Projection {
        return this._projection;
    }

    abstract get data(): D;
}

export class VectorData extends LayerData<Array<OlFeature>> {
    _data: Array<OlFeature>;
    _extent: [number, number, number, number];

    static olParse(
        time: Time,
        projection: Projection,
        extent: [number, number, number, number],
        source: Document | Node | any | string,
        opt_options?: {dataProjection: OlProjectionLike; featureProjection: OlProjectionLike},
    ): VectorData {
        return new VectorData(time, projection, new OlFormatGeoJSON().readFeatures(source, opt_options), extent);
    }

    constructor(time: Time, projection: Projection, data: Array<OlFeature>, extent: [number, number, number, number]) {
        super('vector', time, projection);
        this._data = data;
        this._extent = extent;
        this.fakeIds(); // FIXME: use real IDs ...
    }

    get data(): Array<OlFeature> {
        return this._data;
    }

    get extent(): [number, number, number, number] {
        return this._extent;
    }

    fakeIds() {
        for (let localRowId = 0; localRowId < this.data.length; localRowId++) {
            const feature = this.data[localRowId];
            if (feature.getId() === undefined) {
                feature.setId(localRowId);
            }
        }
    }
}

export class RasterData extends LayerData<string> {
    _data: string;

    constructor(time: Time, projection: Projection, data: string) {
        if (time.getEnd().isAfter(time.getStart())) {
            time = new TimePoint(time.getStart());
        }
        super('raster', time, projection);
        this._data = data;
    }

    get data(): string {
        return this._data;
    }
}

export interface LayerChanges<S extends AbstractSymbology> {
    name?: string;
    symbology?: S;
    editSymbology?: boolean;
    visible?: boolean;
    expanded?: boolean;
    operator?: Operator;
}

export interface VectorLayerData {
    data$: Observable<Array<OlFeature>>;
    dataExtent$?: Observable<[number, number, number, number]>;
    state$: Observable<LoadingState>;
    reload$: Observer<void>;
}

export interface LayerProvenance {
    provenance$: Observable<Iterable<Provenance>>;
    state$: Observable<LoadingState>;
    reload$: Observer<void>;
}

interface LayerConfig<S extends AbstractSymbology> {
    name: string;
    operator: Operator;
    symbology: S;
    expanded?: boolean;
    visible?: boolean;
    editSymbology?: boolean;
}

interface VectorLayerConfig<S extends AbstractVectorSymbology> extends LayerConfig<S> {
    clustered?: boolean;
}

interface RasterLayerConfig<S extends AbstractRasterSymbology> extends LayerConfig<S> {
    // tslint:disable-line:no-empty-interface
}

type LayerType = 'raster' | 'vector';

interface LayerTypeOptionsDict {
    // tslint:disable-line:no-empty-interface
}

interface VectorLayerTypeOptionsDict extends LayerTypeOptionsDict {
    clustered: boolean;
}

/**
 * Dictionary for serialization.
 */
export interface LayerDict {
    name: string;
    operator: OperatorDict;
    symbology: SymbologyDict;
    expanded: boolean;
    visible: boolean;
    editSymbology: boolean;
    type: LayerType;
    typeOptions?: LayerTypeOptionsDict;
}

export abstract class Layer<S extends AbstractSymbology> {
    protected _name: string;
    protected _expanded = false;
    protected _visible = true;
    protected _editSymbology = false;
    protected _symbology: S;
    protected _operator: Operator;

    /**
     * Create the suitable layer type and initialize the callbacks.
     */
    static fromDict(dict: LayerDict, operatorMap = new Map<number, Operator>()): Layer<AbstractSymbology> {
        switch (dict.type) {
            case 'raster':
                return RasterLayer.fromDict(dict, operatorMap);
            case 'vector':
                return VectorLayer.fromDict(dict, operatorMap);
            default:
                throw new Error('LayerService.createLayerFromDict: Unknown LayerType ->' + dict);
        }
    }

    protected constructor(config: LayerConfig<S>) {
        this._name = config.name;
        this._operator = config.operator;
        this._symbology = config.symbology;
        if (config.expanded) {
            this._expanded = config.expanded;
        }
        if (config.visible) {
            this._visible = config.visible;
        }
        if (config.editSymbology) {
            this._editSymbology = config.editSymbology;
        }
    }

    /**
     * Changes the underlying data
     * Do not use this method publically!!!
     */
    _changeUnderlyingData(data: LayerChanges<S>): LayerChanges<S> {
        const validChanges: LayerChanges<S> = {};

        if (data.name && data.name !== this._name) {
            this._name = data.name;
            validChanges.name = this._name;
        }

        if (data.symbology !== undefined) {
            this._symbology = data.symbology;
            validChanges.symbology = this._symbology;
        }

        if (data.visible !== undefined && data.visible !== this._visible) {
            this._visible = data.visible;
            validChanges.visible = this._visible;
        }

        if (data.expanded !== undefined && data.expanded !== this._expanded) {
            this._expanded = data.expanded;
            validChanges.expanded = this._expanded;
        }

        if (data.editSymbology !== undefined && data.editSymbology !== this._editSymbology) {
            this._editSymbology = data.editSymbology;
            validChanges.editSymbology = this._editSymbology;
        }

        if (data.operator !== undefined && data.operator !== this.operator) {
            this._operator = data.operator;
            validChanges.operator = this._operator;
        }

        return validChanges;
    }

    get operator(): Operator {
        return this._operator;
    }

    get name(): string {
        return this._name;
    }

    get symbology(): S {
        return this._symbology;
    }

    get expanded(): boolean {
        return this._expanded;
    }

    get visible(): boolean {
        return this._visible;
    }

    get editSymbology(): boolean {
        return this._editSymbology;
    }

    abstract getLayerType(): LayerType;

    toDict(): LayerDict {
        return {
            name: this.name,
            operator: this._operator.toDict(),
            symbology: this.symbology.toDict(),
            expanded: this.expanded,
            visible: this.visible,
            editSymbology: this.editSymbology,
            type: this.getLayerType(),
            typeOptions: this.typeOptions,
        };
    }

    protected get typeOptions(): LayerTypeOptionsDict {
        return {};
    }
}

export class VectorLayer<S extends AbstractVectorSymbology> extends Layer<S> {
    clustered = false;

    static fromDict(dict: LayerDict, operatorMap = new Map<number, Operator>()): Layer<AbstractVectorSymbology> {
        const operator = Operator.fromDict(dict.operator, operatorMap);
        const typeOptions = dict.typeOptions as VectorLayerTypeOptionsDict;

        const clustered = (typeOptions && typeOptions.clustered && typeOptions.clustered) || false;

        return new VectorLayer({
            name: dict.name,
            operator,
            symbology: AbstractSymbology.fromDict(dict.symbology) as AbstractVectorSymbology,
            visible: dict.visible,
            expanded: dict.expanded,
            editSymbology: dict.editSymbology,
            clustered,
        });
    }

    constructor(config: VectorLayerConfig<S>) {
        super(config);
        this.clustered = !!config.clustered;
    }

    getLayerType(): LayerType {
        return 'vector';
    }

    protected get typeOptions(): VectorLayerTypeOptionsDict {
        return {
            clustered: this.clustered,
        };
    }
}

export class RasterLayer<S extends AbstractRasterSymbology> extends Layer<S> {
    static fromDict(dict: LayerDict, operatorMap = new Map<number, Operator>()): Layer<AbstractRasterSymbology> {
        const operator = Operator.fromDict(dict.operator, operatorMap);
        const symbology = AbstractSymbology.fromDict(dict.symbology) as AbstractRasterSymbology | MappingRasterSymbology;

        return new RasterLayer({
            name: dict.name,
            operator,
            symbology,
            visible: dict.visible,
            expanded: dict.expanded,
            editSymbology: dict.editSymbology,
        });
    }

    constructor(config: RasterLayerConfig<S>) {
        super(config);
        if (!config.symbology.unit) {
            config.symbology.unit = config.operator.units.get('value');
        }
    }

    getLayerType(): LayerType {
        return 'raster';
    }
}
