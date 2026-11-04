/**
 * Product decisions of the 丝路 SilkRoad distribution that differ from
 * upstream DeepSeek Harness Desktop.
 *
 * SilkRoad ships without DeepSeek account sign-in, product analytics and the
 * official update feed: models are reached with the user's own API keys, and
 * the matching Host rows are disabled in the bundle patches. These flags keep
 * the Desktop main process from talking to those absent services.
 */

/** Whether the welcome window offers DeepSeek account sign-in and the main process watches the account stream. */
export const ACCOUNT_SIGN_IN = false

/** Whether the app menu offers 检查更新…; there is no SilkRoad update feed yet. */
export const UPDATE_MENU = false

/**
 * Directory name of SilkRoad's Electron user data under the OS application-data folder.
 * Electron would otherwise derive it from the upstream package name and share
 * DeepSeek Harness Desktop's storage and single-instance lock.
 */
export const USER_DATA_DIRECTORY = 'SilkRoad'
