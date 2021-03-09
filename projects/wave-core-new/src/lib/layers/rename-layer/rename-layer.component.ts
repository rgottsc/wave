import {Component, OnInit, ChangeDetectionStrategy, Inject} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {Layer} from '../layer.model';
import {ProjectService} from '../../project/project.service';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';

@Component({
    selector: 'wave-rename-layer',
    templateUrl: './rename-layer.component.html',
    styleUrls: ['./rename-layer.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RenameLayerComponent implements OnInit {
    form: FormGroup;

    private layer: Layer;

    constructor(
        private projectService: ProjectService,
        private formBuilder: FormBuilder,
        private dialogRef: MatDialogRef<RenameLayerComponent>,
        @Inject(MAT_DIALOG_DATA) private config: {layer?: Layer},
    ) {}

    ngOnInit(): void {
        this.layer = this.config.layer;
        this.form = this.formBuilder.group({
            layerName: [this.layer.name, Validators.required],
        });
    }

    /**
     * Save the layer name and close the dialog.
     */
    save() {
        const layerName = this.form.controls['layerName'].value;
        if (layerName === this.layer.name) {
            return;
        }

        this.projectService.changeLayer(this.layer, {name: layerName}).subscribe(
            () => this.dialogRef.close(),
            (error) => {
                // TODO: handle error
            },
        );
    }
}
