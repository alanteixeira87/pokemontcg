const ExcelJS = require('exceljs');
(async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Cartas');
  ws.addRow(['série', 'numero', 'sequencia', 'status']);
  ws.addRow(['Chamas Obsidianas', '001/197', '', 'ok']);
  ws.addRow(['151', '001/165', '', 'ok']);
  ws.addRow(['Chamas Obsidianas', '002/197', '', '']);
  await wb.xlsx.writeFile('import-test.xlsx');
})();
