export function revalidatePath() {}
export function redirect(location) {
  const error = new Error(`NEXT_REDIRECT:${location}`);
  error.digest = `NEXT_REDIRECT;replace;${location}`;
  throw error;
}
export function cookies() {
  return { get: () => undefined, set() {}, delete() {} };
}
export function notFound() {}
export default function Link(props) {
  return props;
}
