import { 
    Document, Packer, Paragraph, Table, TableRow, TableCell, 
    TextRun, WidthType, AlignmentType, HeadingLevel, 
    BorderStyle, ShadingType, Footer, PageNumber 
} from 'docx';

const BRAND_COLOR = '1E3A5F';

/**
 * Generates a DOCX (Word) document from report data.
 * Returns a Buffer ready for S3 upload or direct download.
 */
export async function generateDocx(
    reportType: string,
    data: any,
    fileName: string
): Promise<Buffer> {
    const sections = buildSections(reportType, data);

    const doc = new Document({
        creator: 'TaskMaster PPM',
        title: `${formatReportType(reportType)} Report`,
        description: `Auto-generated ${reportType} report from TaskMaster PPM`,
        sections: [{
            properties: {},
            headers: {},
            footers: {
                default: new Footer({
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({ text: 'TaskMaster PPM — ', size: 16, color: '999999' }),
                                new TextRun({ text: 'Page ', size: 16, color: '999999' }),
                                new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '999999' }),
                                new TextRun({ text: ' of ', size: 16, color: '999999' }),
                                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: '999999' }),
                            ],
                        }),
                    ],
                }),
            },
            children: sections,
        }],
    });

    const buffer = await Packer.toBuffer(doc);
    return Buffer.from(buffer);
}

function formatReportType(type: string): string {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function createHeading(text: string): Paragraph {
    return new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text, bold: true, size: 32, color: BRAND_COLOR })],
        spacing: { after: 200 },
    });
}

function createSubHeading(text: string): Paragraph {
    return new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text, bold: true, size: 24, color: BRAND_COLOR })],
        spacing: { before: 300, after: 100 },
    });
}

function createParagraph(text: string): Paragraph {
    return new Paragraph({
        children: [new TextRun({ text, size: 20 })],
        spacing: { after: 100 },
    });
}

function createTable(headers: string[], rows: string[][]): Table {
    const headerRow = new TableRow({
        tableHeader: true,
        children: headers.map(h => new TableCell({
            width: { size: Math.floor(9000 / headers.length), type: WidthType.DXA },
            shading: { type: ShadingType.SOLID, color: BRAND_COLOR },
            children: [new Paragraph({
                children: [new TextRun({ text: h, bold: true, color: 'FFFFFF', size: 20 })],
                alignment: AlignmentType.CENTER,
            })],
        })),
    });

    const dataRows = rows.map((row, idx) => new TableRow({
        children: row.map(cell => new TableCell({
            width: { size: Math.floor(9000 / headers.length), type: WidthType.DXA },
            shading: idx % 2 === 0 ? { type: ShadingType.SOLID, color: 'F0F4F8' } : undefined,
            children: [new Paragraph({
                children: [new TextRun({ text: String(cell ?? ''), size: 18 })],
            })],
        })),
    }));

    return new Table({
        width: { size: 9000, type: WidthType.DXA },
        rows: [headerRow, ...dataRows],
        borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
            left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
            right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'EEEEEE' },
            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'EEEEEE' },
        },
    });
}

function buildSections(reportType: string, data: any): (Paragraph | Table)[] {
    const elements: (Paragraph | Table)[] = [];

    elements.push(createHeading(`${formatReportType(reportType)} Report`));
    elements.push(createParagraph(`Generated: ${new Date().toLocaleString()}`));

    switch (reportType) {
        case 'STATUS': {
            const s = data.taskSummary;
            elements.push(createSubHeading('Task Summary'));
            elements.push(createTable(
                ['Metric', 'Value'],
                [['Total Tasks', String(s.total)], ['To Do', String(s.todo)], ['In Progress', String(s.inProgress)], ['Done', String(s.done)], ['Overdue', String(s.overdue)]]
            ));

            if (data.topBlockers?.length > 0) {
                elements.push(createSubHeading('Top Blockers'));
                elements.push(createTable(
                    ['Task', 'Days Since Created', 'Assignee'],
                    data.topBlockers.map((b: any) => [b.taskTitle, String(b.daysSinceCreated), String(b.assignee)])
                ));
            }
            break;
        }
        case 'TIME_VARIANCE': {
            elements.push(createSubHeading('Summary'));
            elements.push(createTable(
                ['Metric', 'Value'],
                [
                    ['Estimated Hours', String(data.summary.totalEstimatedHours)],
                    ['Logged Hours', String(data.summary.totalLoggedHours)],
                    ['Variance', String(data.summary.varianceHours)],
                    ['Variance %', `${data.summary.variancePercent}%`],
                ]
            ));
            if (data.byTask?.length > 0) {
                elements.push(createSubHeading('By Task'));
                elements.push(createTable(
                    ['Task', 'Estimated', 'Logged', 'Variance'],
                    data.byTask.map((t: any) => [t.taskTitle, String(t.estimatedHours), String(t.loggedHours), String(t.variance)])
                ));
            }
            break;
        }
        case 'COST': {
            elements.push(createSubHeading('Cost Summary'));
            elements.push(createTable(
                ['Metric', 'Value'],
                [
                    ['Budgeted Cost', `$${data.summary.budgetedCost.toFixed(2)}`],
                    ['Actual Cost', `$${data.summary.actualCost.toFixed(2)}`],
                    ['Variance', `$${data.summary.variance.toFixed(2)}`],
                    ['CPI', String(data.summary.cpi)],
                ]
            ));
            break;
        }
        case 'TIMESHEET': {
            elements.push(createSubHeading('Timesheet Data'));
            if (data.rows?.length > 0) {
                elements.push(createTable(
                    ['User', 'Week Start', 'Hours', 'Status'],
                    data.rows.map((r: any) => [r.userName, String(r.weekStart), String(r.totalHours), r.status])
                ));
            }
            break;
        }
        default:
            elements.push(createParagraph(JSON.stringify(data, null, 2)));
    }

    return elements;
}
