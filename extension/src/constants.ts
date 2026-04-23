export const PRIMARY_APP_URL = "https://powershot.org";
export const POWERSHOT_DELIVER_CAPTURE = "POWERSHOT_DELIVER_CAPTURE";
export const POWERSHOT_CAPTURE_VISIBLE = "POWERSHOT_CAPTURE_VISIBLE";
export const POWERSHOT_CAPTURE_REGION = "POWERSHOT_CAPTURE_REGION";

export function buildNewNoteUrl() {
  return `${PRIMARY_APP_URL}/new?source=extension`;
}
