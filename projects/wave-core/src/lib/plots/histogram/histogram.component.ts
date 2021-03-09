import {
    Component,
    ChangeDetectionStrategy,
    Input,
    Output,
    AfterViewInit,
    EventEmitter,
    ViewChild,
    ElementRef,
    OnChanges,
    SimpleChange,
    OnDestroy,
} from '@angular/core';

import {LayoutService} from '../../layout.service';
import {fromEvent as observableFromEvent, Subscription} from 'rxjs';
import {debounceTime, filter} from 'rxjs/operators';
import {Config} from '../../config.service';
import * as d3 from 'd3';

/**
 * Schema for histogram data.
 */
export interface HistogramData {
    type: string; // histogram
    data: Array<number>;
    lines?: Array<{name: string; pos: number}>;
    metadata: {
        numberOfBuckets: number;
        min: number;
        max: number;
        nodata: number;
        unit: string;
    };
}

/**
 * Helper class for slider dimension
 */
interface SliderDim {
    width: number;
    height: number;
    margin: {
        top: number;
        bottom: number;
    };
}

/**
 * Helper interface for a slider
 */
interface Slider {
    area: d3.Selection<SVGElement, any, any, any>;
    pointer: d3.Selection<SVGElement, any, any, any>;
    text: d3.Selection<SVGElement, any, any, any>;
    position: number;
}

/**
 * This component displays a histogram plot response as a d3 graph.
 */
@Component({
    selector: 'wave-histogram',
    templateUrl: `histogram.component.html`,
    styleUrls: [`histogram.component.scss`],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistogramComponent implements AfterViewInit, OnChanges, OnDestroy {
    @ViewChild('svg', {static: true}) svgRef: ElementRef;

    /**
     * The histogram data from the backend response
     */
    @Input() data: HistogramData;

    /**
     * The height of the plot
     */
    @Input() height: number;

    /**
     * The width of the plot
     */
    @Input() width: number;

    /**
     * A scaling factor for width and height
     */
    @Input() viewBoxRatio = 1;

    /**
     * If set to true, users can select an interval within the histogram
     */
    @Input() selectable = false;

    /**
     * If set to true, users can zoom and pan within the graph
     */
    @Input() interactable = false;

    /**
     * If set to true, the component will call its event emitter upfront
     */
    @Input() emmitInitialDataMinMax = false;

    /**
     * If set to true, the component will react on resize events of the browser and redraw automatically.
     */
    @Input() autoResize = false;

    /**
     * Specify the minimum of the selection interval
     */
    @Input() minRange: number = undefined;

    /**
     * Emit events when the user selection (min) changes
     */
    @Output() minRangeChange = new EventEmitter<number>();

    /**
     * Specify the maximum of the selection interval
     */
    @Input() maxRange: number = undefined;

    /**
     * Emit events when the user selection (max) changes
     */
    @Output() maxRangeChange = new EventEmitter<number>();

    private leftSlider: Slider;
    private rightSlider: Slider;
    private xAxis: d3.Axis<d3.AxisDomain>;
    private maxWidth: number;
    private windowEventSubscription: Subscription;

    /**
     * DI for services
     */
    constructor(private elementRef: ElementRef, private config: Config) {}

    private static makeArea(xSlider: d3.Selection<SVGElement, any, any, any>, height: number): d3.Selection<SVGElement, any, any, any> {
        return xSlider.append('rect').attr('x', 0).attr('width', 0).attr('height', height).attr('fill-opacity', 0.2);
    }

    private static makePointer(
        xSlider: d3.Selection<SVGElement, any, any, any>,
        height: number,
        sliderDim: SliderDim,
        xPosition: number,
    ): d3.Selection<SVGElement, any, any, any> {
        return xSlider
            .append('rect')
            .attr('y', height + sliderDim.margin.top)
            .attr('x', xPosition)
            .attr('width', sliderDim.width)
            .attr('height', sliderDim.height)
            .attr('transform', 'translate(' + -(sliderDim.width / 2) + ',0)');
    }

    private static makeText(
        xSlider: d3.Selection<SVGElement, any, any, any>,
        height: number,
        sliderDim: SliderDim,
        xPosition: number,
        value: number,
    ): d3.Selection<SVGElement, any, any, any> {
        return xSlider
            .append('text')
            .text(value.toFixed(2))
            .attr('x', xPosition - sliderDim.width / 2 + 5)
            .attr('y', sliderDim.margin.top + height + sliderDim.height + sliderDim.margin.bottom);
    }

    ngOnDestroy(): void {
        if (this.windowEventSubscription) {
            this.windowEventSubscription.unsubscribe();
        }
    }

    ngOnChanges(changes: {[propertyName: string]: SimpleChange}) {
        if (changes['data'] && !changes['data'].isFirstChange()) {
            // clean up histogram
            this.clearHistogram();

            // draw new one
            this.drawHistogram();
            if (this.emmitInitialDataMinMax) {
                this.minRangeChange.emit(this.data.metadata.min);
                this.maxRangeChange.emit(this.data.metadata.max);
            }
        }
        // TODO: refactor the set slider position function out (here and in makeDrag)
        if (changes['minRange'] && !changes['minRange'].isFirstChange()) {
            const value = changes['minRange'].currentValue;
            const xPosition = Math.max(this.xAxis.scale()(value), 0);
            this.leftSlider.pointer.attr('x', xPosition);
            this.leftSlider.position = value;
            this.leftSlider.text.attr('x', xPosition);
            this.leftSlider.text.text(value);
            this.leftSlider.area.attr('width', xPosition);
        }
        if (changes['maxRange'] && !changes['maxRange'].isFirstChange()) {
            const value = changes['maxRange'].currentValue;
            const xPosition = Math.min(this.xAxis.scale()(value), this.maxWidth);
            this.rightSlider.pointer.attr('x', xPosition);
            this.rightSlider.position = value;
            this.rightSlider.text.attr('x', xPosition);
            this.rightSlider.text.text(value);
            this.rightSlider.area.attr('width', this.maxWidth - xPosition);
            this.rightSlider.area.attr('x', xPosition);
        }
    }

    private clearHistogram() {
        d3.select(this.svgRef.nativeElement).select('g').remove();
    }

    ngAfterViewInit() {
        if (!this.width || !this.height) {
            this.calculateHistogramWidthAndHeight();
        }

        if (this.data) {
            this.drawHistogram();
            if (this.emmitInitialDataMinMax) {
                this.minRangeChange.emit(this.data.metadata.min);
                this.maxRangeChange.emit(this.data.metadata.max);
            }
        }
        this.windowEventSubscription = observableFromEvent(window, 'resize')
            .pipe(
                filter((_) => this.autoResize),
                debounceTime(this.config.DELAYS.DEBOUNCE),
            )
            .subscribe(() => {
                this.clearHistogram();
                this.calculateHistogramWidthAndHeight();
                this.drawHistogram();
            });
    }

    private drawHistogram() {
        const drawLines: boolean = this.data.lines !== undefined;

        const maxDigitsOnYAxis = Math.max(...this.data.data.map((v) => (v > 9 ? Math.ceil(Math.log10(v)) : 1)));

        const xAxisTextPadding = 5;
        const xAxisTextHeight = 10 + xAxisTextPadding;

        const margin = {
            top: 10,
            right: 50,
            bottom: 30 + (this.data.metadata.unit ? xAxisTextHeight : 0) + (this.selectable ? 35 : 0),
            left: 12 * maxDigitsOnYAxis + 25,
        };

        const width = this.width * this.viewBoxRatio - margin.left - margin.right;
        this.maxWidth = width;
        const height = this.height * this.viewBoxRatio - margin.top - margin.bottom;

        const x = d3.scaleLinear().domain([this.data.metadata.min, this.data.metadata.max]).range([0, width]);

        const y = d3
            .scaleLinear()
            .domain([0, d3.max(this.data.data)])
            .range([height, 0]);

        const xAxis = d3.axisBottom(x);
        this.xAxis = xAxis;

        const yAxis = d3.axisLeft(y).tickFormat(d3.format('d')); // allow only integer ticks

        const svg = d3
            .select(this.svgRef.nativeElement)
            .attr('width', this.width)
            .attr('height', this.height)
            .attr('viewBox', [0, 0, this.width * this.viewBoxRatio, this.height * this.viewBoxRatio].join(' '))
            .append('g')
            .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

        const container = svg.append('g').classed('container', true);

        const barWidth = width / this.data.metadata.numberOfBuckets;

        const bar = container
            .selectAll('.bar')
            .data(this.data.data)
            .enter()
            .append('g')
            .classed('bar', true)
            .attr('transform', (d, i) => {
                const xPos = i * barWidth;
                return `translate(${xPos},0)`;
            });

        bar.append('rect')
            .attr('height', (d) => {
                return height - y(d);
            })
            .attr('width', barWidth > 1 ? barWidth - 1 : barWidth)
            .attr('transform', (d, _i) => {
                const yTrans = y(d);
                return `translate(0,${yTrans})`;
            });

        /* draw vertical lines */
        if (drawLines) {
            const lineContainer = container.append('g');
            const lines = lineContainer.selectAll('.lines').data(this.data.lines).enter().append('g').attr('class', 'lines');
            lines
                .append('rect')
                .attr('x', (d) => {
                    return x(d.pos);
                }) // position()
                .attr('y', y(0) - height)
                .attr('height', height)
                .attr('width', 1);

            lines
                .append('text')
                .attr('x', (d) => {
                    return x(d.pos) + 5;
                }) // position()
                .attr('y', y(0) - height + 20)
                .text((d) => {
                    return d.name;
                });
        }

        const borders = svg.append('g').attr('transform', `translate(${-margin.left},${-margin.top})`);

        borders.append('rect').attr('width', margin.left).attr('height', this.height).attr('fill', 'white');

        borders
            .append('rect')
            .attr('x', margin.left + width)
            .attr('height', this.height)
            .attr('width', margin.left)
            .attr('fill', 'white');

        svg.append('g').attr('class', 'x axis').attr('transform', `translate(0,${height})`).call(xAxis);

        if (this.data.metadata.unit) {
            svg.append('g')
                .append('text') // x axis label
                .attr('x', width / 2)
                .attr('y', height + margin.bottom - xAxisTextPadding)
                .style('text-anchor', 'middle')
                .text(this.data.metadata.unit);
        }

        svg.append('g').attr('class', 'y axis').call(yAxis);

        svg.append('text') // y axis label
            .attr('transform', 'rotate(-90)')
            .attr('y', -margin.left)
            .attr('x', -height / 2)
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .text('Frequency');

        let zoom: d3.ZoomBehavior<any, any>;
        if (this.selectable) {
            // sliders to select a range

            const sliderDim: SliderDim = {
                width: 10,
                height: 20,
                margin: {
                    top: 20,
                    bottom: 10,
                },
            };

            const xSlider = svg.append('g');

            const leftSlider: Slider = {
                area: HistogramComponent.makeArea(xSlider, height),
                pointer: HistogramComponent.makePointer(xSlider, height, sliderDim, 0),
                text: HistogramComponent.makeText(xSlider, height, sliderDim, 0, this.data.metadata.min),
                position: this.data.metadata.min,
            };
            this.leftSlider = leftSlider;

            const rightSlider: Slider = {
                area: HistogramComponent.makeArea(xSlider, height),
                pointer: HistogramComponent.makePointer(xSlider, height, sliderDim, width),
                text: HistogramComponent.makeText(xSlider, height, sliderDim, width, this.data.metadata.max),
                position: this.data.metadata.max,
            };
            this.rightSlider = rightSlider;

            const leftDrag = this.makeDrag(xAxis, leftSlider, leftSlider, rightSlider, width, true);
            const rightDrag = this.makeDrag(xAxis, rightSlider, leftSlider, rightSlider, width, false);
            leftSlider.pointer.call(leftDrag);
            rightSlider.pointer.call(rightDrag);

            // zoom
            if (this.interactable) {
                zoom = d3
                    .zoom()
                    .scaleExtent([1, 10])
                    .on('zoom', this.sliderZoomed(svg, container, xAxis, height, width, leftSlider, rightSlider));
            }
        } else {
            if (this.interactable) {
                zoom = d3.zoom().scaleExtent([1, 10]).on('zoom', this.zoomed(svg, container, xAxis));
            }
        }

        const chartbg = svg.append('rect').attr('class', 'chartbg').attr('width', width).attr('height', height);

        if (this.interactable) {
            chartbg.call(zoom);
        }
    }

    private zoomed(
        svg: d3.Selection<SVGElement, any, any, any>,
        container: d3.Selection<SVGElement, any, any, any>,
        xAxis: d3.Axis<d3.AxisDomain>,
    ): (zoomEvent: d3.D3ZoomEvent<any, any>) => void {
        return (zoomEvent) => {
            container.attr('transform', `translate(${zoomEvent.transform.x},0)scale(${zoomEvent.transform.k},1)`);
            svg.select('.x.axis').call(xAxis);
        };
    }

    private sliderZoomed(
        svg: d3.Selection<SVGElement, any, any, any>,
        container: d3.Selection<SVGElement, any, any, any>,
        xAxis: d3.Axis<d3.AxisDomain>,
        _height: number,
        width: number,
        leftSlider: Slider,
        rightSlider: Slider,
    ): (zoomEvent: d3.D3ZoomEvent<any, any>) => void {
        return (zoomEvent) => {
            this.zoomed(svg, container, xAxis)(zoomEvent);

            // set left slider
            const leftPointerPosition = clamp(xAxis.scale()(leftSlider.position), 0, width);
            leftSlider.area.attr('width', leftPointerPosition);
            leftSlider.pointer.attr('x', leftPointerPosition);
            leftSlider.text.attr('x', leftPointerPosition);

            // set right slider
            const rightPointerPosition = clamp(xAxis.scale()(rightSlider.position), 0, width);
            rightSlider.area.attr('width', width - rightPointerPosition);
            rightSlider.area.attr('x', rightPointerPosition);
            rightSlider.pointer.attr('x', rightPointerPosition);
            rightSlider.text.attr('x', rightPointerPosition);
        };
    }

    private makeDrag(
        xAxis: d3.Axis<d3.AxisDomain>,
        slider: Slider,
        leftSlider: Slider,
        rightSlider: Slider,
        width: number,
        isLeft: boolean,
    ): d3.DragBehavior<any, any, any> {
        return d3.drag().on('drag', (dragEvent: d3.D3DragEvent<any, any, any>) => {
            const minX = this.data.metadata.min;
            const maxX = this.data.metadata.max;
            const bins = this.data.metadata.numberOfBuckets;

            const eventX = dragEvent.x;

            let lowerbound: number;
            let upperbound: number;
            if (isLeft) {
                if (xAxis.scale()(minX) > 0) {
                    lowerbound = xAxis.scale()(minX);
                } else {
                    lowerbound = 0;
                }
            } else {
                lowerbound = xAxis.scale()(leftSlider.position) + 1;
            }
            if (!isLeft) {
                if (xAxis.scale()(maxX) < width) {
                    upperbound = xAxis.scale()(maxX);
                } else {
                    upperbound = width;
                }
            } else {
                upperbound = xAxis.scale()(rightSlider.position) - 1;
            }

            let newX: number;
            if (eventX > lowerbound && eventX < upperbound) {
                newX = eventX;
            } else if (eventX <= lowerbound) {
                newX = lowerbound;
            } else {
                newX = upperbound;
            }

            // snap to closest bar
            let newXVal = (xAxis.scale() as d3.ScaleLinear<any, any>).invert(newX);
            const bw = (maxX - minX) / bins;
            const n = Math.round((newXVal - minX) / bw);
            newX = xAxis.scale()(minX + n * bw);
            newXVal = (xAxis.scale() as d3.ScaleLinear<any, any>).invert(newX);

            slider.pointer.attr('x', newX);
            slider.position = newXVal;
            slider.text.attr('x', newX);
            slider.text.text(newXVal);
            if (isLeft) {
                this.minRange = newXVal;
                this.minRangeChange.emit(this.minRange);
            } else {
                this.maxRange = newXVal;
                this.maxRangeChange.emit(this.maxRange);
            }
            if (isLeft) {
                if (newX > 0) {
                    slider.area.attr('width', newX);
                } else {
                    slider.area.attr('width', 0);
                }
            } else {
                slider.area.attr('width', width - newX);
                slider.area.attr('x', newX);
            }
        });
    }

    private calculateHistogramWidthAndHeight() {
        const queryElem = this.elementRef.nativeElement.querySelector('div');
        const panelWidth = queryElem.clientWidth - 2 * LayoutService.remInPx;
        const panelheight = queryElem.clientHeight - 2 * LayoutService.remInPx;
        this.width = panelWidth;
        this.height = Math.max(panelheight / 3, panelWidth / 3);
    }
}

/**
 * Restrict a value to the interval [min, max]
 */
function clamp(value: number, min: number, max: number): number {
    if (value <= min) {
        return min;
    } else if (value >= max) {
        return max;
    } else {
        return value;
    }
}
