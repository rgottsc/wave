import {combineLatest as observableCombineLatest, BehaviorSubject, Observable, ReplaySubject} from 'rxjs';
import {first, map} from 'rxjs/operators';

import {ChangeDetectionStrategy, Component, OnInit} from '@angular/core';
import {UserService} from '../../../users/user.service';
import {Operator} from '../../operator.model';
import {VectorLayer} from '../../../layers/layer.model';
import {ResultTypes} from '../../result-type.model';
import {AbstractVectorSymbology, PointSymbology, VectorSymbology} from '../../../layers/symbology/symbology.model';
import {RandomColorService} from '../../../util/services/random-color.service';
import {CsvDialogComponent} from '../csv/csv-dialog/csv-dialog.component';
import {MatDialog} from '@angular/material/dialog';
import {ProjectService} from '../../../project/project.service';

function nameComparator(a: string, b: string): number {
    const stripped = (s: string): string => s.replace(' ', '');

    return stripped(a).localeCompare(stripped(b));
}

@Component({
    selector: 'wave-featuredb-source-list',
    templateUrl: './featuredb-source-list.component.html',
    styleUrls: ['./featuredb-source-list.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeaturedbSourceListComponent implements OnInit {
    searchString$ = new BehaviorSubject<string>('');
    entries$ = new ReplaySubject<Array<{name: string; operator: Operator}>>(1);
    filteredEntries$: Observable<Array<{name: string; operator: Operator}>>;

    constructor(
        private userService: UserService,
        private projectService: ProjectService,
        private randomColorService: RandomColorService,
        public dialog: MatDialog,
    ) {}

    ngOnInit() {
        this.refresh();

        this.filteredEntries$ = observableCombineLatest(this.entries$, this.searchString$, (entries, searchString) =>
            entries.filter((entry) => entry.name.indexOf(searchString) >= 0).sort((a, b) => nameComparator(a.name, b.name)),
        );
    }

    refresh() {
        this.userService
            .getFeatureDBList()
            .pipe(map((entries) => entries.sort()))
            .subscribe((entries) => this.entries$.next(entries));
    }

    openCSVDialog() {
        this.dialog
            .open(CsvDialogComponent)
            .afterClosed()
            .pipe(first())
            .subscribe(() => this.refresh());
    }

    add(entry: {name: string; operator: Operator}) {
        const color = this.randomColorService.getRandomColorRgba();
        let symbology: AbstractVectorSymbology;
        let clustered: boolean;

        if (entry.operator.resultType === ResultTypes.POINTS) {
            symbology = PointSymbology.createClusterSymbology({
                fillRGBA: color,
            });
            clustered = true;
        } else {
            symbology = VectorSymbology.createSymbology({
                fillRGBA: color,
            });
            clustered = false;
        }

        const layer = new VectorLayer({
            name: entry.name,
            operator: entry.operator,
            symbology,
            clustered,
        });
        this.projectService.addLayer(layer);
    }
}
