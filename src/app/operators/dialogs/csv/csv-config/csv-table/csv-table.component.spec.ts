import {ChangeDetectorRef} from '@angular/core';
import {CsvPropertiesService} from '../../csv-dialog/csv.properties.service';
import {CsvTableComponent} from './csv-table.component';
import {FormsModule} from '@angular/forms';
import {MaterialModule} from '../../../../../material.module';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {ComponentFixtureSpecHelper} from '../../../../../spec/component-fixture-spec.helper';
import { HEADER_TABLE_ID, BODY_TABLE_ID } from './csv-table.component';
import 'hammerjs';

describe('Component: CsvTableComponent', () => {
    let service: CsvPropertiesService;
    let fixture: ComponentFixtureSpecHelper<CsvTableComponent>;
    let component: CsvTableComponent;

    beforeEach(() => {
        fixture = new ComponentFixtureSpecHelper<CsvTableComponent>({
            declarations: [
                CsvTableComponent
            ],
            imports: [
                MaterialModule,
                FormsModule,
                BrowserAnimationsModule
            ],
            providers: [
                CsvPropertiesService,
                ChangeDetectorRef
            ]
        }, CsvTableComponent, {
            data: {
                file: new File(['"a,b",c,d\n"1,2",3,4'], 'test-file.csv', {lastModified : (new Date()).getDate(), type: 'csv'}),
                content: '"a,b",c,d\n"1,2",3,4',
                progress: 100,
                isNull: false
            },
            cellSpacing: 10,
            linesToParse: 15
        });

        component = fixture.getComponentInstance();
        service = fixture.getInjected(CsvPropertiesService);
    });

    it('should parse and update correctly', () => {
        service.changeDataProperties({
            delimiter: ',',
            decimalSeparator: '.',
            isTextQualifier: false,
            textQualifier: '"',
            isHeaderRow: true,
            headerRow: 0,
        });
        fixture.detectChanges();
        expect(getHeader().length).toBe(4);
        expect(numberOfTableColumns()).toBe(4);
        service.changeDataProperties({
            delimiter: ',',
            decimalSeparator: '.',
            isTextQualifier: true,
            textQualifier: '"',
            isHeaderRow: true,
            headerRow: 0,
        });
        fixture.detectChanges();
        expect(getHeader().length).toBe(3);
        expect(numberOfTableColumns()).toBe(3);
    });

    it('resizes table columns and synchronizes header and body widths when using custom headers', async () => {
        component.data.content = '"a,b",c,dddddddddddddd\n"1,2",3,4';
        const TABLE_WIDTH = 4;
        service.changeDataProperties({
            delimiter: ',',
            decimalSeparator: '.',
            isTextQualifier: false,
            textQualifier: '"',
            isHeaderRow: false,
            headerRow: 0,
        });
        fixture.detectChanges();
        let header_row = headerRow();
        let body_row = bodyRow();
        expect(tableWidthWithoutSpacers(header_row)).toBe(TABLE_WIDTH);
        expect(tableWidthWithoutSpacers(body_row)).toBe(TABLE_WIDTH);
        fixture.whenStable().then(() => {
            for (let i = 0; i < header_row.length; i++) {
                expect(clientWidth(header_row[i])).toBe(
                    i % 2 === 0 ?
                        component.cellSizes[i / 2] :
                        component.cellSpacing
                ); // Test whether or not the table resizes to the given values.
                expect(clientWidth(header_row[i])).toBe(clientWidth(body_row[i]));
                // Test if body and header have synchronized cell widths.
            }
        });
    });

    function getHeader(): {value: string}[] {
        return component.header;
    };

    function numberOfTableColumns(): number {
        const table_rows = fixture.getElementsByTagName('tr');
        if (table_rows.length === 0) {
            return 0;
        }
        return tableWidthWithoutSpacers(table_rows[table_rows.length - 1].getElementsByTagName('td'));
    };

    function headerRow(): HTMLCollectionOf<HTMLTableCellElement> {
        let tables = fixture.getElementsByTagName('table');
        let header_table = null;
        for (let i = 0; i < tables.length; i++) {
            if (tables[i].id === HEADER_TABLE_ID) {
                header_table = tables[i];
            }
        }
        return header_table.getElementsByTagName('tr')[0].getElementsByTagName('td');
    };

    function bodyRow(): HTMLCollectionOf<HTMLTableCellElement> {
        let tables = fixture.getElementsByTagName('table');
        let body_table = null;
        for (let i = 0; i < tables.length; i++) {
            if (tables[i].id === BODY_TABLE_ID) {
                body_table = tables[i];
            }
        }
        return body_table.getElementsByTagName('tr')[0].getElementsByTagName('td');
    };

    function clientWidth(element: HTMLElement): number {
        return element.getBoundingClientRect().width;
    };

    function tableWidthWithoutSpacers(row: HTMLCollectionOf<HTMLTableCellElement>): number {
        return (row.length + 1) / 2
    }
});
