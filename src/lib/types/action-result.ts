// Unified return type for all Server Actions
// Success: { data: T }
// Failure: { error: string; code?: string }

export type ActionSuccess<T> = {
  data: T
}

export type ActionError = {
  error: string
  code?: string
}

export type ActionResult<T> = ActionSuccess<T> | ActionError

export function isActionError<T>(result: ActionResult<T>): result is ActionError {
  return 'error' in result
}

export function isActionSuccess<T>(result: ActionResult<T>): result is ActionSuccess<T> {
  return 'data' in result
}

export function actionSuccess<T>(data: T): ActionSuccess<T> {
  return { data }
}

export function actionError(error: string, code?: string): ActionError {
  return { error, ...(code ? { code } : {}) }
}
