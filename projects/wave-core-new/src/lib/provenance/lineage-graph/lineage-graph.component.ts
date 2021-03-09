import {BehaviorSubject, Observable, ReplaySubject} from 'rxjs';
import {map} from 'rxjs/operators';
import {Component, OnInit, ChangeDetectionStrategy, ViewChild, ElementRef, AfterViewInit, Inject} from '@angular/core';
import * as dagre from 'dagre';
import * as dagreD3 from 'dagre-d3';
import * as d3 from 'd3';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {Layer} from '../../layers/layer.model';
import {OperatorDict, SourceOperatorDict} from '../../backend/backend.model';
import {LayoutService} from '../../layout.service';
import {ProjectService} from '../../project/project.service';
import {createIconDataUrl} from '../../util/icons';

const GRAPH_STYLE = {
    general: {
        width: 200,
        headerHeight: 48,
        margin: 5,
    },
    operator: {
        height: 136,
        borderHeight: 1,
    },
    surrounding: {
        margin: 40,
        detailComponentWidth: 200,
    },
};

@Component({
    selector: 'wave-lineage-graph',
    templateUrl: './lineage-graph.component.html',
    styleUrls: ['./lineage-graph.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LineageGraphComponent implements OnInit, AfterViewInit {
    @ViewChild('svg', {static: true}) svg: ElementRef;
    @ViewChild('g', {static: true}) g: ElementRef;

    svgWidth$: Observable<number>;
    svgHeight$: Observable<number>;

    loaderDiameter$: Observable<number>;
    loaderLeft$: Observable<string>;

    loading$ = new BehaviorSubject(true);

    title = 'Layer Lineage';
    layer: Layer;

    selectedOperator$ = new ReplaySubject<OperatorDict | SourceOperatorDict>(1);
    selectedOperatorIcon$ = new ReplaySubject<string>(1);
    parameters$ = new ReplaySubject<Array<{key: string; value: string}>>(1);

    private maxWidth$ = new BehaviorSubject<number>(1);
    private maxHeight$ = new BehaviorSubject<number>(1);

    private svgRatio = 0.7;

    constructor(
        private elementRef: ElementRef,
        private projectService: ProjectService,
        private layoutService: LayoutService,
        private dialogRef: MatDialogRef<LineageGraphComponent>,
        @Inject(MAT_DIALOG_DATA) private config: {layer: Layer},
    ) {}

    ngOnInit() {
        this.svgWidth$ = this.maxWidth$.pipe(map((width) => Math.ceil(this.svgRatio * width)));
        this.svgHeight$ = this.maxHeight$;

        this.loaderDiameter$ = this.svgWidth$.pipe(map((width) => width / 6));
        this.loaderLeft$ = this.loaderDiameter$.pipe(map((diameter) => `calc(50% - ${diameter}px / 2)`));

        this.layer = this.config.layer;
        this.title = `Lineage for ${this.layer.name}`;
    }

    ngAfterViewInit() {
        setTimeout(() => {
            this.calculateDialogBounds();

            setTimeout(() => {
                this.drawGraph();
            });
        });
    }

    private calculateDialogBounds() {
        let dialogContainer;
        let parent = this.elementRef.nativeElement.parentElement;
        while (!dialogContainer) {
            dialogContainer = parent.querySelector('.cdk-overlay-pane');
            parent = parent.parentElement;
        }

        const width = parseInt(getComputedStyle(dialogContainer).maxWidth, 10) - 2 * LayoutService.remInPx;
        const maxHeight = window.innerHeight * 0.8;

        this.maxWidth$.next(width);
        this.maxHeight$.next(maxHeight);
    }

    private drawGraph() {
        this.projectService.getWorkflow(this.layer.workflowId).subscribe((workflow) => {
            const graph = new dagreD3.graphlib.Graph().setGraph({}).setDefaultEdgeLabel(() => ({label: ''} as any));

            LineageGraphComponent.addOperatorsToGraph(graph, workflow.operator);

            LineageGraphComponent.addLayerToGraph(graph, this.layer, 0);

            // create the renderer
            const render = new dagreD3.render();

            // Set up an SVG group so that we can translate the final graph.
            // console.log(this.graphContainer.nativeElement);
            const svg = d3.select(this.svg.nativeElement);
            const svgGroup = d3.select(this.g.nativeElement);

            // Run the renderer. This is what draws the final graph.
            render(svgGroup, graph);

            LineageGraphComponent.fixLabelPosition(svg);

            this.loading$.next(false);

            // do this asynchronously to start a new cycle of change detection
            setTimeout(() => {
                const sizes = this.setupWidthObservables(graph);
                this.addZoomSupport(svg, svgGroup, graph, sizes.width, sizes.height);
                this.addClickHandler(svg, graph);
            });
        });
    }

    private static addOperatorsToGraph(graph: dagre.graphlib.Graph, initialOperator: OperatorDict | SourceOperatorDict) {
        let nextOperatorId = 0;

        const operatorQueue: Array<[number, OperatorDict | SourceOperatorDict]> = [[nextOperatorId++, initialOperator]];
        const edges: Array<[number, number]> = [];

        while (operatorQueue.length > 0) {
            const [operator_id, operator] = operatorQueue.pop();

            // add node to graph
            graph.setNode(`operator_${operator_id}`, {
                operator,
                type: 'operator',
                class: `operator operator_${operator_id}`,
                labelType: 'html',
                label: `
                <div class="header">
                    <img src='${createIconDataUrl(operator.type)}' class='icon' alt="${operator.type}">
                    </span>
                    ${operator.type}
                </div>
                <div class="parameters">
                    <table>
                        <tr>
                        ${this.parametersDisplayList(operator)
                            .map((kv) => `<td class='key'>${kv.key}</td><td class='value'>${kv.value}</td>`)
                            .join('</tr><tr>')}
                        </tr>
                    </table>
                </div>
                `,
                padding: 0,
                width: GRAPH_STYLE.general.width,
                height: GRAPH_STYLE.operator.height,
            });

            // add children
            for (const sourceType of ['raster_sources', 'vector_sources']) {
                if (sourceType in operator) {
                    const sources: Array<OperatorDict | SourceOperatorDict> = operator[sourceType];
                    for (const source of sources) {
                        const child_id = nextOperatorId++;
                        operatorQueue.push([child_id, source]);
                        edges.push([child_id, operator_id]);
                    }
                }
            }
        }

        // add edges to graph
        for (const [sourceId, targetId] of edges) {
            graph.setEdge(`operator_${sourceId}`, `operator_${targetId}`);
        }

        // console.log(graph.edges(), graph);
    }

    private static addLayerToGraph(graph: dagre.graphlib.Graph, layer: Layer, workflow_id: number) {
        // add node
        graph.setNode(`layer_${layer.workflowId}`, {
            class: 'layer',
            type: 'layer',
            labelType: 'html',
            label: `<div class='header'>${layer.name}</div>`,
            padding: 0,
            width: GRAPH_STYLE.general.width,
            height: GRAPH_STYLE.general.headerHeight,
        });

        // add edge
        graph.setEdge(`operator_${workflow_id}`, `layer_${layer.workflowId}`, {
            class: 'layer-edge',
        });
    }

    private addZoomSupport(
        svg: d3.Selection<SVGElement, any, any, any>,
        svgGroup: d3.Selection<SVGElement, any, any, any>,
        graph: dagre.graphlib.Graph,
        svgWidth: number,
        svgHeight: number,
    ) {
        // calculate available space after subtracting the margin
        const paddedWidth = svgWidth - GRAPH_STYLE.surrounding.margin;
        const paddedHeight = svgHeight - GRAPH_STYLE.surrounding.margin;

        // calculate the initial zoom level that captures the whole graph
        const scale = Math.min(
            paddedWidth / graph.graph().width,
            paddedHeight / graph.graph().height,
            1, // do not scale more than 100% of size initially
        );

        const initialX = (svgWidth - scale * graph.graph().width) / 2;
        const initialY = (svgHeight - scale * graph.graph().height) / 2;

        // create zoom behavior
        const zoom = d3.zoom();

        // apply zoom to svg
        svgGroup.transition().duration(500).call(zoom.transform, d3.zoomIdentity.translate(initialX, initialY).scale(scale));

        // add zoom handler
        zoom.on('zoom', (zoomEvent: d3.D3ZoomEvent<any, any>) => {
            const zoomTranslate = isNaN(zoomEvent.transform.x) ? [0, 0] : [zoomEvent.transform.x, zoomEvent.transform.y];
            const zoomScale = isNaN(zoomEvent.transform.k) ? 0 : zoomEvent.transform.k;
            svgGroup.attr('transform', `translate(${zoomTranslate})scale(${zoomScale})`);
        });
        svg.call(zoom);
    }

    private addClickHandler(svg: d3.Selection<SVGElement, any, any, any>, graph: dagre.graphlib.Graph) {
        svg.selectAll('.node').on('click', (_event, theNodeId) => {
            const nodeId = (theNodeId as any) as string; // conversion since the signature is of the wrong type

            const node = graph.node(nodeId);
            if (node.type === 'operator') {
                const operator: OperatorDict | SourceOperatorDict = node.operator;

                // update operator type
                this.selectedOperator$.next(operator);
                this.selectedOperatorIcon$.next(createIconDataUrl(operator.type));

                // update parameter view
                this.parameters$.next(LineageGraphComponent.parametersDisplayList(operator));

                // de-select all
                svg.selectAll('.operator').classed('highlight', false);
                // set highlight
                svg.select(`.${nodeId}`).classed('highlight', true);
            }
        });
    }

    private static parametersDisplayList(operator: OperatorDict | SourceOperatorDict): Array<{key: string; value: string}> {
        const list = [];

        const params = operator.params;
        for (const key of Object.keys(params)) {
            let value = JSON.stringify(params[key], null, 2);

            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.substr(1, value.length - 2);
            }

            list.push({key, value});
        }

        return list;
    }

    private static fixLabelPosition(svg: d3.Selection<SVGElement, any, any, any>) {
        // HACK: move html label from center to top left
        svg.selectAll('.operator > .label > g > foreignObject')
            .attr('x', -GRAPH_STYLE.general.width / 2)
            .attr('y', -GRAPH_STYLE.operator.height / 2)
            .attr('width', GRAPH_STYLE.general.width)
            .attr('height', GRAPH_STYLE.operator.height);
        svg.selectAll('.layer > .label > g > foreignObject')
            .attr('x', -GRAPH_STYLE.general.width / 2)
            .attr('y', -GRAPH_STYLE.general.headerHeight / 2)
            .attr('width', GRAPH_STYLE.general.width)
            .attr('height', GRAPH_STYLE.general.headerHeight);
        svg.selectAll('.label > g').attr('transform', undefined);
    }

    private setupWidthObservables(graph: dagre.graphlib.Graph): {width: number; height: number} {
        const widthBound = (maxWidth: number, graphWidth: number) => {
            return Math.min(maxWidth - GRAPH_STYLE.surrounding.detailComponentWidth - GRAPH_STYLE.surrounding.margin, graphWidth);
        };
        const heightBound = (maxWidth: number, _graphWidth: number) => {
            // return Math.min(maxWidth, graphWidth + GRAPH_STYLE.surrounding.margin);
            // noinspection JSSuspiciousNameCombination
            return maxWidth;
        };

        // return the current width bounds
        return {
            width: widthBound(this.maxWidth$.getValue(), graph.graph().width),
            height: heightBound(this.maxHeight$.getValue(), graph.graph().height),
        };
    }
}
