import ExcelJS from "exceljs";
import { E2E } from "./config";

/**
 * The reference template (LDDLT plan, 18 rows), moved into the future and renamed so it never
 * collides with the seeded demo campaign. `edit` can introduce errors in the planning.
 */
export async function lddltFile(path: string, edit?: (planning: ExcelJS.Worksheet) => void) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile("docs/templates/modele-campagne.xlsx");
  const campaign = wb.getWorksheet("Campagne")!;
  campaign.getCell("B3").value = `Import e2e ${Date.now()}`;
  campaign.getCell("B4").value = new Date(`${E2E.demoStart}T00:00:00Z`);
  edit?.(wb.getWorksheet("Planning")!);
  await wb.xlsx.writeFile(path);
}
