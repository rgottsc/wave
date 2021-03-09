import {UUID, ToDict, PlotDict} from '../backend/backend.model';

export type PlotType = 'JSON' | 'PNG';

export class Plot implements HasPlotId, ToDict<PlotDict> {
    protected static nextPlotId = 0;

    readonly id: number;

    readonly name: string;
    readonly workflowId: UUID;

    static fromDict(dict: PlotDict): Plot {
        return new Plot({
            name: dict.name,
            workflowId: dict.workflow,
        });
    }

    constructor(config: {id?: number; name: string; workflowId: string}) {
        this.id = config.id ?? Plot.nextPlotId++;

        this.name = config.name;
        this.workflowId = config.workflowId;
    }

    updateFields(changes: {id?: number; name?: string; workflowId?: string}): Plot {
        return new Plot({
            id: changes.id ?? this.id,
            name: changes.name ?? this.name,
            workflowId: changes.workflowId ?? this.workflowId,
        });
    }

    equals(other: Plot): boolean {
        if (!(other instanceof Plot)) {
            return false;
        }

        return this.id === other.id && this.name === other.name && this.workflowId === other.workflowId;
    }

    toDict(): PlotDict {
        return {
            name: this.name,
            workflow: this.workflowId,
        };
    }
}

export interface HasPlotId {
    readonly id: number;
}
