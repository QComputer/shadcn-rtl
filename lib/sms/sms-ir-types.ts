export type SmsIrLine = number | string

export type SmsIrSendResult = {
  packId: string
  messageIds: number[]
  cost: number
}

export type SmsIrResponse<T> = {
  status: number
  message: string
  data?: T
}

export type SmsIrGetLinesInput = {
  pageSize?: number
}

export type SmsIrSendBulkInput = {
  lineNumber: string | number
  messageText: string
  mobiles: string[]
  sendDateTime?: number | null
}

export type SmsIrSendLikeToLikeInput = {
  lineNumber: string | number
  messageTexts: string[]
  mobiles: string[]
  sendDateTime?: number | null
}

export type SmsIrMessageReport = {
  messageId: number
  mobile: string
  messageText: string
  sendDateTime: number
  lineNumber: string | number
  cost: number
  deliveryState: number | null
  deliveryDateTime: number | null
}

export type SmsIrPackSummary = {
  packId: string
  recipientCount: number
  creationDateTime: number
}

export type SmsIrPackMessage = {
  messageId: number
  mobile: string
  messageText: string
  sendDateTime: number
  lineNumber: string | number
  cost: number
  deliveryState: number | null
  deliveryDateTime: number | null
}

export type SmsIrPaginationInput = {
  pageSize?: number
  pageNumber?: number
}

export type SmsIrArchiveInput = {
  fromDate?: number
  toDate?: number
  pageSize?: number
  pageNumber?: number
}
