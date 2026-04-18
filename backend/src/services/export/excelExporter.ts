import ExcelJS from 'exceljs';

const BRAND_COLOR = '1E3A5F';
const BRAND_FONT_COLOR = 'FFFFFF';
const ALT_ROW_COLOR = 'F0F4F8';

/**
 * Generates a styled Excel workbook from report data.
 * Returns a Buffer ready for S3 upload or direct download.
 */
export async function generateExcel(
    reportType: string, 
    data: any, 
    fileName: string
): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TaskMaster PPM';
    workbook.created = new Date();

    switch (reportType) {
        case 'STATUS':
            buildStatusReport(workbook, data);
            break;
        case 'TIME_VARIANCE':
            buildTimeVarianceReport(workbook, data);
            break;
        case 'COST':
            buildCostReport(workbook, data);
            break;
        case 'RESOURCE':
            buildResourceReport(workbook, data);
            break;
        case 'TIMESHEET':
            buildTimesheetReport(workbook, data);
            break;
        default:
            buildGenericReport(workbook, data, reportType);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
}

function applyHeaderStyle(row: ExcelJS.Row) {
    row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_COLOR } };
        cell.font = { bold: true, color: { argb: BRAND_FONT_COLOR }, size: 11 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
            bottom: { style: 'thin', color: { argb: '333333' } }
        };
    });
}

function applyAlternatingRows(sheet: ExcelJS.Worksheet, startRow: number) {
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber > startRow && rowNumber % 2 === 0) {
            row.eachCell(cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT_ROW_COLOR } };
            });
        }
    });
}

function autoFitColumns(sheet: ExcelJS.Worksheet) {
    sheet.columns.forEach(col => {
        let maxLength = 10;
        col.eachCell?.({ includeEmpty: true }, cell => {
            const len = cell.value ? cell.value.toString().length : 0;
            if (len > maxLength) maxLength = len;
        });
        col.width = Math.min(maxLength + 4, 40);
    });
}

function buildStatusReport(workbook: ExcelJS.Workbook, data: any) {
    // Summary sheet
    const summary = workbook.addWorksheet('Summary');
    summary.addRow(['TaskMaster — Status Report']);
    summary.addRow([`Generated: ${new Date().toISOString()}`]);
    summary.addRow([]);

    const s = data.taskSummary;
    summary.addRow(['Metric', 'Value']);
    applyHeaderStyle(summary.getRow(4));
    summary.addRow(['Total Tasks', s.total]);
    summary.addRow(['To Do', s.todo]);
    summary.addRow(['In Progress', s.inProgress]);
    summary.addRow(['Done', s.done]);
    summary.addRow(['Overdue', s.overdue]);
    autoFitColumns(summary);

    // Blockers sheet
    if (data.topBlockers?.length > 0) {
        const blockers = workbook.addWorksheet('Blockers');
        blockers.addRow(['Task Title', 'Days Since Created', 'Assignee']);
        applyHeaderStyle(blockers.getRow(1));
        data.topBlockers.forEach((b: any) => blockers.addRow([b.taskTitle, b.daysSinceCreated, b.assignee]));
        applyAlternatingRows(blockers, 1);
        autoFitColumns(blockers);
    }

    // Upcoming Deadlines
    if (data.upcomingDeadlines?.length > 0) {
        const deadlines = workbook.addWorksheet('Upcoming Deadlines');
        deadlines.addRow(['Task Title', 'Due Date', 'Priority', 'Assignee']);
        applyHeaderStyle(deadlines.getRow(1));
        data.upcomingDeadlines.forEach((d: any) => deadlines.addRow([d.taskTitle, d.dueDate, d.priority, d.assignee]));
        applyAlternatingRows(deadlines, 1);
        autoFitColumns(deadlines);
    }
}

function buildTimeVarianceReport(workbook: ExcelJS.Workbook, data: any) {
    // Summary
    const summary = workbook.addWorksheet('Summary');
    summary.addRow(['Time Variance Report']);
    summary.addRow([]);
    summary.addRow(['Metric', 'Value']);
    applyHeaderStyle(summary.getRow(3));
    summary.addRow(['Total Estimated Hours', data.summary.totalEstimatedHours]);
    summary.addRow(['Total Logged Hours', data.summary.totalLoggedHours]);
    summary.addRow(['Variance (Hours)', data.summary.varianceHours]);
    summary.addRow(['Variance (%)', `${data.summary.variancePercent}%`]);
    autoFitColumns(summary);

    // By Task
    const byTask = workbook.addWorksheet('By Task');
    byTask.addRow(['Task ID', 'Task Title', 'Estimated Hours', 'Logged Hours', 'Variance']);
    applyHeaderStyle(byTask.getRow(1));
    data.byTask.forEach((t: any) => byTask.addRow([t.taskId, t.taskTitle, t.estimatedHours, t.loggedHours, t.variance]));
    applyAlternatingRows(byTask, 1);
    autoFitColumns(byTask);

    // By Member
    const byMember = workbook.addWorksheet('By Member');
    byMember.addRow(['User ID', 'Estimated Hours', 'Logged Hours', 'Variance']);
    applyHeaderStyle(byMember.getRow(1));
    data.byMember.forEach((m: any) => byMember.addRow([m.userId, m.estimatedHours, m.loggedHours, m.variance]));
    applyAlternatingRows(byMember, 1);
    autoFitColumns(byMember);
}

function buildCostReport(workbook: ExcelJS.Workbook, data: any) {
    const summary = workbook.addWorksheet('Cost Summary');
    summary.addRow(['Cost Report']);
    summary.addRow([]);
    summary.addRow(['Metric', 'Value']);
    applyHeaderStyle(summary.getRow(3));
    summary.addRow(['Budgeted Cost', `$${data.summary.budgetedCost.toFixed(2)}`]);
    summary.addRow(['Actual Cost', `$${data.summary.actualCost.toFixed(2)}`]);
    summary.addRow(['Variance', `$${data.summary.variance.toFixed(2)}`]);
    summary.addRow(['CPI', data.summary.cpi]);
    autoFitColumns(summary);

    const byMember = workbook.addWorksheet('By Member');
    byMember.addRow(['Name', 'Hourly Rate', 'Hours Logged', 'Total Cost']);
    applyHeaderStyle(byMember.getRow(1));
    data.byMember.forEach((m: any) => byMember.addRow([m.name, `$${m.hourlyRate}`, m.hoursLogged, `$${m.cost.toFixed(2)}`]));
    applyAlternatingRows(byMember, 1);
    autoFitColumns(byMember);
}

function buildResourceReport(workbook: ExcelJS.Workbook, data: any) {
    const sheet = workbook.addWorksheet('Resource Availability');
    sheet.addRow(['User', 'Date', 'Total Allocation %', 'Holiday', 'Over-Allocated']);
    applyHeaderStyle(sheet.getRow(1));

    if (Array.isArray(data)) {
        for (const user of data) {
            if (user.dailyData) {
                for (const day of user.dailyData) {
                    sheet.addRow([
                        user.user?.name || user.user?.email || 'Unknown',
                        day.date,
                        day.totalAllocation,
                        day.isHoliday ? 'Yes' : 'No',
                        day.isOverAllocated ? 'YES' : 'No',
                    ]);
                }
            }
        }
    }
    applyAlternatingRows(sheet, 1);
    autoFitColumns(sheet);
}

function buildTimesheetReport(workbook: ExcelJS.Workbook, data: any) {
    const sheet = workbook.addWorksheet('Timesheets');
    sheet.addRow(['User', 'Week Start', 'Total Hours', 'Status']);
    applyHeaderStyle(sheet.getRow(1));
    data.rows?.forEach((r: any) => sheet.addRow([r.userName, r.weekStart, r.totalHours, r.status]));
    applyAlternatingRows(sheet, 1);
    autoFitColumns(sheet);
}

function buildGenericReport(workbook: ExcelJS.Workbook, data: any, reportType: string) {
    const sheet = workbook.addWorksheet(reportType);
    sheet.addRow([`${reportType} Report — Generated ${new Date().toISOString()}`]);
    sheet.addRow([JSON.stringify(data, null, 2)]);
}
