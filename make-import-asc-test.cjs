const ExcelJS = require('exceljs');
(async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Cartas');
  ws.addRow(['serie', 'numero', 'sequencia', 'status', 'qtde']);
  ws.addRow(['ASC', '4', '217', 'ok', '']);
  await wb.xlsx.writeFile('import-asc-test.xlsx');
})();
