import PDFDocument from 'pdfkit';

const BRAND_COLOR = '#1E3A5F';
const HEADER_BG = '#1E3A5F';
const TEXT_COLOR = '#333333';

/**
 * Generates a PDF document from report data.
 * Returns a Buffer ready for S3 upload or direct download.
 */
export async function generatePdf(
    reportType: string,
    data: any,
    fileName: string
): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ 
            margin: 50, 
            size: 'A4',
            info: {
                Title: `${reportType} Report — TaskMaster`,
                Author: 'TaskMaster PPM',
                Creator: 'TaskMaster Report Engine',
            }
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        doc.rect(0, 0, doc.page.width, 80).fill(BRAND_COLOR);
        doc.fontSize(22).fillColor('#FFFFFF').text('TaskMaster', 50, 25, { continued: true });
        doc.fontSize(14).text(` — ${formatReportType(reportType)} Report`, { continued: false });
        doc.fontSize(9).text(`Generated: ${new Date().toLocaleString()}`, 50, 55);

        doc.moveDown(3);
        doc.fillColor(TEXT_COLOR);

        switch (reportType) {
            case 'STATUS':
                renderStatusPdf(doc, data);
                break;
            case 'TIME_VARIANCE':
                renderTimeVariancePdf(doc, data);
                break;
            case 'COST':
                renderCostPdf(doc, data);
                break;
            case 'TIMESHEET':
                renderTimesheetPdf(doc, data);
                break;
            default:
                renderGenericPdf(doc, data, reportType);
        }

        // Footer on each page
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
            doc.switchToPage(i);
            doc.fontSize(8).fillColor('#999999');
            doc.text(
                `TaskMaster PPM · Page ${i + 1} of ${pages.count}`,
                50,
                doc.page.height - 40,
                { align: 'center', width: doc.page.width - 100 }
            );
        }

        doc.end();
    });
}

function formatReportType(type: string): string {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function renderSummaryTable(doc: typeof PDFDocument.prototype, rows: [string, string | number][]) {
    const startX = 50;
    let y = doc.y + 10;
    const colWidth = 250;

    for (const [label, value] of rows) {
        doc.fontSize(10).fillColor(TEXT_COLOR);
        doc.text(label, startX, y, { width: colWidth, continued: false });
        doc.text(String(value), startX + colWidth, y, { width: colWidth });
        y += 20;
    }
    doc.y = y + 10;
}

function renderDataTable(doc: typeof PDFDocument.prototype, headers: string[], rows: any[][]) {
    const startX = 50;
    const colWidth = (doc.page.width - 100) / headers.length;
    let y = doc.y + 5;

    // Header row
    doc.rect(startX, y, doc.page.width - 100, 22).fill(BRAND_COLOR);
    doc.fontSize(9).fillColor('#FFFFFF');
    headers.forEach((h, i) => {
        doc.text(h, startX + (i * colWidth) + 4, y + 6, { width: colWidth - 8 });
    });
    y += 22;

    // Data rows
    doc.fillColor(TEXT_COLOR).fontSize(9);
    rows.forEach((row, rowIdx) => {
        if (y > doc.page.height - 80) {
            doc.addPage();
            y = 50;
        }
        if (rowIdx % 2 === 0) {
            doc.rect(startX, y, doc.page.width - 100, 18).fill('#F0F4F8');
            doc.fillColor(TEXT_COLOR);
        }
        row.forEach((cell, i) => {
            doc.text(String(cell ?? ''), startX + (i * colWidth) + 4, y + 4, { width: colWidth - 8 });
        });
        y += 18;
    });
    doc.y = y + 10;
}

function renderStatusPdf(doc: any, data: any) {
    const s = data.taskSummary;
    doc.fontSize(14).fillColor(BRAND_COLOR).text('Task Summary');
    doc.moveDown(0.5);
    renderSummaryTable(doc, [
        ['Total Tasks', s.total],
        ['To Do', s.todo],
        ['In Progress', s.inProgress],
        ['Completed', s.done],
        ['Overdue', s.overdue],
    ]);

    if (data.topBlockers?.length > 0) {
        doc.fontSize(14).fillColor(BRAND_COLOR).text('Top Blockers');
        doc.moveDown(0.5);
        renderDataTable(doc, ['Task', 'Days Since Created', 'Assignee'],
            data.topBlockers.map((b: any) => [b.taskTitle, b.daysSinceCreated, b.assignee])
        );
    }
}

function renderTimeVariancePdf(doc: any, data: any) {
    doc.fontSize(14).fillColor(BRAND_COLOR).text('Time Variance Summary');
    doc.moveDown(0.5);
    renderSummaryTable(doc, [
        ['Total Estimated Hours', data.summary.totalEstimatedHours],
        ['Total Logged Hours', data.summary.totalLoggedHours],
        ['Variance (Hours)', data.summary.varianceHours],
        ['Variance (%)', `${data.summary.variancePercent}%`],
    ]);

    if (data.byTask?.length > 0) {
        doc.fontSize(14).fillColor(BRAND_COLOR).text('Breakdown by Task');
        doc.moveDown(0.5);
        renderDataTable(doc, ['Task', 'Estimated', 'Logged', 'Variance'],
            data.byTask.map((t: any) => [t.taskTitle, t.estimatedHours, t.loggedHours, t.variance])
        );
    }
}

function renderCostPdf(doc: any, data: any) {
    doc.fontSize(14).fillColor(BRAND_COLOR).text('Cost Summary');
    doc.moveDown(0.5);
    renderSummaryTable(doc, [
        ['Budgeted Cost', `$${data.summary.budgetedCost.toFixed(2)}`],
        ['Actual Cost', `$${data.summary.actualCost.toFixed(2)}`],
        ['Variance', `$${data.summary.variance.toFixed(2)}`],
        ['Cost Performance Index', data.summary.cpi],
    ]);

    if (data.byMember?.length > 0) {
        doc.fontSize(14).fillColor(BRAND_COLOR).text('Cost by Member');
        doc.moveDown(0.5);
        renderDataTable(doc, ['Name', 'Hourly Rate', 'Hours', 'Cost'],
            data.byMember.map((m: any) => [m.name, `$${m.hourlyRate}`, m.hoursLogged, `$${m.cost.toFixed(2)}`])
        );
    }
}

function renderTimesheetPdf(doc: any, data: any) {
    doc.fontSize(14).fillColor(BRAND_COLOR).text('Timesheet Report');
    doc.moveDown(0.5);
    if (data.rows?.length > 0) {
        renderDataTable(doc, ['User', 'Week Start', 'Total Hours', 'Status'],
            data.rows.map((r: any) => [r.userName, r.weekStart, r.totalHours, r.status])
        );
    } else {
        doc.fontSize(10).fillColor(TEXT_COLOR).text('No timesheet data found for the selected period.');
    }
}

function renderGenericPdf(doc: any, data: any, reportType: string) {
    doc.fontSize(14).fillColor(BRAND_COLOR).text(`${reportType} Report`);
    doc.moveDown();
    doc.fontSize(9).fillColor(TEXT_COLOR).text(JSON.stringify(data, null, 2));
}
