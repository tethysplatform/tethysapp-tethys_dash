import appAPI from "services/api/app";
import { downloadLayerFile } from "components/map/layerFileCache";

const file = { filename: "style.json", dashboard_uuid: "dashboard-1" };

test("downloads a saved layer file once per page", async () => {
  const download = jest
    .spyOn(appAPI, "downloadJSON")
    .mockResolvedValue({ success: true, data: { fill: "#fff" } });

  const first = await downloadLayerFile(file);
  const second = await downloadLayerFile(file);

  expect(download).toHaveBeenCalledTimes(1);
  expect(first).toStrictEqual({ success: true, data: { fill: "#fff" } });
  expect(second).toStrictEqual(first);
});

test("hands each caller its own copy, so preparing one layer cannot alter another", async () => {
  jest
    .spyOn(appAPI, "downloadJSON")
    .mockResolvedValue({ success: true, data: { fill: "#fff" } });

  const first = await downloadLayerFile(file);
  first.data.fill = "#000";
  const second = await downloadLayerFile(file);

  expect(second.data).toStrictEqual({ fill: "#fff" });
});

test("shares one request between callers that ask at the same time", async () => {
  const download = jest
    .spyOn(appAPI, "downloadJSON")
    .mockResolvedValue({ success: true, data: {} });

  await Promise.all([downloadLayerFile(file), downloadLayerFile(file)]);

  expect(download).toHaveBeenCalledTimes(1);
});

test("keys a file by its dashboard as well as its name", async () => {
  const download = jest
    .spyOn(appAPI, "downloadJSON")
    .mockResolvedValue({ success: true, data: {} });

  await downloadLayerFile(file);
  await downloadLayerFile({ ...file, dashboard_uuid: "dashboard-2" });

  expect(download).toHaveBeenCalledTimes(2);
});

test("lets go of a dashboard's files once another dashboard's are asked for", async () => {
  const download = jest
    .spyOn(appAPI, "downloadJSON")
    .mockResolvedValue({ success: true, data: {} });

  await downloadLayerFile(file);
  await downloadLayerFile({ ...file, dashboard_uuid: "dashboard-2" });
  await downloadLayerFile(file);

  expect(download).toHaveBeenCalledTimes(3);
});

test("keeps no refusal, which may succeed later", async () => {
  const download = jest
    .spyOn(appAPI, "downloadJSON")
    .mockResolvedValueOnce({ success: false, message: "Invalid file path." })
    .mockResolvedValueOnce({ success: true, data: { fill: "#fff" } });

  const refused = await downloadLayerFile(file);
  const retried = await downloadLayerFile(file);

  expect(refused).toStrictEqual({
    success: false,
    message: "Invalid file path.",
  });
  expect(retried.data).toStrictEqual({ fill: "#fff" });
  expect(download).toHaveBeenCalledTimes(2);
});

test("callers sharing a refused request both see it, and the next one asks again", async () => {
  const download = jest
    .spyOn(appAPI, "downloadJSON")
    .mockResolvedValueOnce({ success: false, message: "Invalid file path." })
    .mockResolvedValueOnce({ success: true, data: {} });

  const shared = await Promise.all([
    downloadLayerFile(file),
    downloadLayerFile(file),
  ]);
  const next = await downloadLayerFile(file);

  expect(shared.map((response) => response.success)).toStrictEqual([
    false,
    false,
  ]);
  expect(next.success).toBe(true);
  expect(download).toHaveBeenCalledTimes(2);
});

test("keeps no failed request, and lets its error through", async () => {
  const download = jest
    .spyOn(appAPI, "downloadJSON")
    .mockRejectedValueOnce(new Error("Network Error"))
    .mockResolvedValueOnce({ success: true, data: {} });

  await expect(downloadLayerFile(file)).rejects.toThrow("Network Error");
  await downloadLayerFile(file);

  expect(download).toHaveBeenCalledTimes(2);
});
