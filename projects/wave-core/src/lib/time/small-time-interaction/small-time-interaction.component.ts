import {Subscription} from 'rxjs';
import {first} from 'rxjs/operators';

import {Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy} from '@angular/core';

import {ProjectService} from '../../project/project.service';
import {LayoutService} from '../../layout.service';
import {TimeConfigComponent} from '../time-config/time-config.component';
import {TimeStepDuration} from '../time.model';

@Component({
    selector: 'wave-small-time-interaction',
    templateUrl: './small-time-interaction.component.html',
    styleUrls: ['./small-time-interaction.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SmallTimeInteractionComponent implements OnInit, OnDestroy {
    private timeStreamSubscription: Subscription;

    timeRepresentation: string;

    timeStepDurationStreamSubscription: Subscription;
    timeStepDuration: TimeStepDuration = {durationAmount: 1, durationUnit: 'months'}; // TODO: get from DEFAULTS?

    constructor(
        private projectService: ProjectService,
        private layoutService: LayoutService,
        private changeDetectorRef: ChangeDetectorRef,
    ) {}

    ngOnInit() {
        this.timeStreamSubscription = this.projectService.getTimeStream().subscribe((t) => {
            this.timeRepresentation = t.toString();
            this.changeDetectorRef.markForCheck();
        });

        this.timeStepDurationStreamSubscription = this.projectService.getTimeStepDurationStream().subscribe((timeStepDuration) => {
            this.timeStepDuration = timeStepDuration;
        });
    }

    ngOnDestroy(): void {
        this.timeStreamSubscription.unsubscribe();
        this.timeStepDurationStreamSubscription.unsubscribe();
    }

    timeForward() {
        this.projectService
            .getTimeStream()
            .pipe(first())
            .subscribe((time) => {
                const nt = time.clone().add(this.timeStepDuration.durationAmount, this.timeStepDuration.durationUnit);
                this.projectService.setTime(nt);
            });
    }

    timeBackwards() {
        this.projectService
            .getTimeStream()
            .pipe(first())
            .subscribe((time) => {
                this.projectService.setTime(
                    time.clone().subtract(this.timeStepDuration.durationAmount, this.timeStepDuration.durationUnit),
                );
            });
    }

    openTimeConfig() {
        this.layoutService.setSidenavContentComponent({component: TimeConfigComponent});
    }
}
