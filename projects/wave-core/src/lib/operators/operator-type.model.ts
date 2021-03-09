// export interface OperatorTypeConfig {} // tslint:disable-line:no-empty-interface

/**
 * Options allowed when cloning the operator
 */
export interface OperatorTypeCloneOptions {} // tslint:disable-line:no-empty-interface

/**
 * Dictionary for querying the server.
 */
export interface OperatorTypeMappingDict {} // tslint:disable-line:no-empty-interface

/**
 * Dictionary for serializing the operator type.
 */
export interface OperatorTypeDict {
    operatorType: string;
}

/**
 * Interface required for complex operator parameter options.
 * It represents display values of type options.
 */
export interface OptionsDict {
    displayValue: string;
}

/**
 * The possible types of parameter values
 */
export type ParameterValue = number | string | OptionsDict;

/**
 * The operator basic type.
 */
export abstract class OperatorType {
    /**
     * Each operator type must have a method that returns
     * an icon as a data uri image. This provides a default
     * out of the operator name.
     */
    public static createIconDataUrl(iconName: string) {
        // TODO: replace with proper icons
        // from `http://stackoverflow.com/questions/3426404/
        // create-a-hexadecimal-colour-based-on-a-string-with-javascript`
        const hashCode = (str: string) => {
            // java String#hashCode
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = str.charCodeAt(i) + ((hash << 5) - hash); // tslint:disable-line:no-bitwise
            }
            return hash;
        };
        const intToRGB = (i: number) => {
            const c = (i & 0x00ffffff).toString(16).toUpperCase(); // tslint:disable-line:no-bitwise

            return '00000'.substring(0, 6 - c.length) + c;
        };

        const color = '#' + intToRGB(hashCode(iconName));
        const size = 64;

        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        context.fillStyle = color;
        context.fillRect(0, 0, 64, 64);
        return canvas.toDataURL('image/png');
    }

    /**
     * Get the server-side name of the type.
     */
    abstract getMappingName(): string;

    /**
     * Human-readable type name.
     */
    abstract toString(): string;

    /**
     * Serialize the operator type.
     */
    abstract toDict(): OperatorTypeDict;

    /**
     * Create query parameter.
     */
    abstract toMappingDict(): OperatorTypeMappingDict;

    /**
     * Icon respresentation of the operator.
     */
    abstract getIconUrl(): string;

    /**
     * Get the value of a parameter
     */
    public getParameterValue(parameterName: string): ParameterValue | undefined {
        return undefined;
    }

    /**
     * Get the DisplayValue of a parameter
     */
    public getParameterDisplayValue(parameterName: string): string | undefined {
        const parameterValue = this.getParameterValue(parameterName);
        if (!parameterValue) {
            return undefined;
        }
        // parameters are either objects of 'OptionDict' i.e. they have a 'displayValue' or 'number | string'
        if (typeof parameterValue === 'object') {
            return parameterValue.displayValue;
        }
        return parameterValue.toString();
    }

    /**
     * Get a human readable parameter list.
     */
    abstract getParametersAsStrings(): Array<[string, string]>;

    /**
     * clone an operator type with modified parameters
     * @param options a dictionary with modifications
     */
    abstract cloneWithModifications(options?: OperatorTypeCloneOptions): OperatorType;
}
