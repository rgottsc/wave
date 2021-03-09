import {Component, OnInit, ChangeDetectionStrategy} from '@angular/core';
import {LayoutService} from '../../layout.service';
import {ChangeSpatialReferenceComponent} from '../change-spatial-reference/change-spatial-reference.component';
import {NewProjectComponent} from '../new-project/new-project.component';
import {LoadProjectComponent} from '../load-project/load-project.component';
import {SaveProjectAsComponent} from '../save-project-as/save-project-as.component';

@Component({
    selector: 'wave-workspace-settings',
    templateUrl: './workspace-settings.component.html',
    styleUrls: ['./workspace-settings.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceSettingsComponent implements OnInit {
    constructor(protected layoutService: LayoutService) {}

    ngOnInit() {}

    loadSpatialReferenceDialog() {
        this.layoutService.setSidenavContentComponent({component: ChangeSpatialReferenceComponent, keepParent: true});
    }

    loadNewProjectDialog() {
        this.layoutService.setSidenavContentComponent({component: NewProjectComponent, keepParent: true});
    }

    loadChangeProjectDialog() {
        this.layoutService.setSidenavContentComponent({component: LoadProjectComponent, keepParent: true});
    }

    loadSaveAsDialog() {
        this.layoutService.setSidenavContentComponent({component: SaveProjectAsComponent, keepParent: true});
    }
}
