export const appleStartupImages = [
  [320, 568, 2], [375, 667, 2], [414, 736, 3], [375, 812, 3],
  [414, 896, 2], [414, 896, 3], [390, 844, 3], [428, 926, 3],
  [393, 852, 3], [430, 932, 3], [402, 874, 3], [440, 956, 3],
  [420, 912, 3], [768, 1024, 2], [810, 1080, 2], [820, 1180, 2],
  [834, 1112, 2], [834, 1194, 2], [1024, 1366, 2], [744, 1133, 2],
  [820, 1194, 2], [834, 1210, 2], [1032, 1376, 2],
].flatMap(([width, height, scale]) => ["portrait", "landscape"].map((orientation) => ({
  url: `/splash/saiway-${orientation === "portrait" ? width * scale : height * scale}x${orientation === "portrait" ? height * scale : width * scale}.png`,
  media: `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${scale}) and (orientation: ${orientation})`,
})));
