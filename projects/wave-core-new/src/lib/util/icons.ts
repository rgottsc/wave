/**
 * Create a Data URI image from a string
 */
export function createIconDataUrl(iconName: string): string {
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
