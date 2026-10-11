// Developer builds are explicit. Normal production/release and tests have no tools.
export const DEV_TOOLS = import.meta.env.DEV_TOOLS === true && !import.meta.env.TEST;
