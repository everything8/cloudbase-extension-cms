import { getState } from 'concent'
import { request, history } from 'umi'
import { notification } from 'antd'
import { RequestOptionsInit } from 'umi-request'
import { uploadFilesToHosting } from '@/services/apis'
import { codeMessage, RESOURCE_PREFIX } from '@/constants'
import defaultSettings from '../../config/defaultSettings'
import { isDevEnv, random } from './common'
import { getDay, getFullDate, getMonth, getYear } from './date'
import { downloadFileFromUrl } from './file'
import { templateCompile } from './templateCompile'
import { cmsConfig } from './config'

interface IntegrationRes {
  statusCode: number
  headers: Record<string, string>
  body: string
  isBase64Encoded: true | false
}

let app: any
let auth: any

/**
 * 用户名密码登录
 * @param username
 * @param password
 */
export async function loginWithPassword(username: string, password: string) {
  // 登陆
  await tcbRequest('/login/account', { method: 'POST', data: {
    username, password
  } })
}

/**
 * 获取当前登录态信息
 */
export async function getLoginState() {
  // 获取登录态
  // return auth.getLoginState()
  return tcbRequest('/login/status')
}

/**
 * 同步获取 x-cloudbase-credentials
 */
 export function getAuthHeader() {
  // return auth.getAuthHeader()
  // return sessionStorage.getItem('x-cloudbase-credentials')
  return { 'x-cloudbase-credentials': 'xxx' }
}

let gotAuthHeader = false
let gotAuthTime = 0
/**
 * 异步获取 x-cloudbase-credentials 请求 Header
 */
export async function getAuthHeaderAsync() {
  // 直接读取本地
  let res = getAuthHeader()
  const diff = Date.now() - gotAuthTime

  // TODO: 当期 SDK 同步获取的 token 可能是过期的
  // 临时解决办法：在首次获取时、间隔大于 3500S 时，刷新 token
  // if (!res?.['x-cloudbase-credentials'] || !gotAuthHeader || diff > 3500000) {
  //   res = await tcbRequest('/auth/header')
  //   gotAuthHeader = true
  //   gotAuthTime = Date.now()
  // }

  return res
}

/**
 * 退出登录
 */
export async function logout() {
  await auth.signOut()
}

/**
 * 兼容本地开发与云函数请求
 */
export async function tcbRequest<T = any>(
  url: string,
  options: RequestOptionsInit & { skipErrorHandler?: boolean } = {}
): Promise<T> {
  // if (isDevEnv() || SERVER_MODE) {
  //   return request<T>(url, options)
  // }

  return request<T>(url, options)
}

/**
 * 上传文件到文件存储、静态托管
 */
export async function uploadFile(options: {
  /**
   * 需要上传的文件
   */
  file: File

  /**
   * 指定上传文件的路径
   */
  filePath?: string

  /**
   * 文件名随机的长度
   */
  filenameLength?: number

  /**
   * 进度事件
   */
  onProgress?: (v: number) => void
  /**
   * 文件上传存储类型，静态网站托管或云存储
   * 默认为 storage
   */
  uploadType?: 'hosting' | 'storage'

  /**
   * 路径模版，根据模版规则做动态替换
   * 以 cloudbase-cms 为基础路径
   */
  filePathTemplate?: string
}): Promise<{
  fileId: string
  url: string
}> {
  const {
    file,
    onProgress,
    filePath,
    uploadType = 'storage',
    filenameLength = 32,
    filePathTemplate,
  } = options

  const day = getFullDate()

  // 文件名
  let ext
  if (file.name?.length && file.name.includes('.')) {
    ext = file.name.split('.').pop()
    ext = `.${ext}`
  } else {
    ext = ''
  }

  // 模版变量
  const templateData: any = {
    // 文件扩展
    ext,
    // 文件名
    filename: file.name,
    // 今日日期
    date: day,
    // 年份，如 2021
    year: getYear(),
    // 月份，如 03
    month: getMonth(),
    // 日，如 02
    day: getDay(),
  }

  // 添加 random1 到 random64
  for (let i = 1; i <= 64; i++) {
    templateData[`random${i}`] = random(i)
  }

  let uploadFilePath: string

  // 路径模版优先级最高
  if (filePathTemplate) {
    uploadFilePath = 'cloudbase-cms/' + templateCompile(filePathTemplate, templateData)
  } else {
    uploadFilePath = filePath || `cloudbase-cms/upload/${day}/${random(filenameLength)}_${ext}`
  }

  // 上传文件到静态托管
  if (uploadType === 'hosting') {
    // 返回 URL 信息数组
    const ret = await uploadFilesToHosting(file, uploadFilePath)
    onProgress?.(100)
    return {
      fileId: ret[0].url,
      url: ret[0].url,
    }
  }

  // 上传文件到云存储
  const result = await app.uploadFile({
    filePath: file,
    cloudPath: uploadFilePath,
    onUploadProgress: (progressEvent: ProgressEvent) => {
      const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
      onProgress?.(percentCompleted)
    },
  })

  const meta = {
    fileId: result.fileID,
    url: result.download_url,
  }

  // 文件 id
  return meta
}

// 获取文件的临时访问链接
export async function getTempFileURL(fileID: string): Promise<string> {
  const result = await app.getTempFileURL({
    fileList: [fileID],
  })

  if (result.fileList[0].code !== 'SUCCESS') {
    throw new Error(result.fileList[0].code)
  }

  return result.fileList[0].tempFileURL
}

/**
 * 批量获取文件临时访问链接
 */
export async function batchGetTempFileURL(
  fileIds: string[]
): Promise<
  {
    fileID: string
    tempFileURL: string
  }[]
> {
  if (!fileIds?.length) return []
  const result = await app.getTempFileURL({
    fileList: fileIds,
  })

  result.fileList.forEach((ret: any) => {
    if (ret.code !== 'SUCCESS') {
      throw new Error(ret.code)
    }
  })

  return result.fileList
}

// 下载文件
export async function downloadFile(fileID: string) {
  const tmpUrl = await getTempFileURL(fileID)
  const fileUrl =
    tmpUrl + `${tmpUrl.includes('?') ? '&' : '?'}response-content-disposition=attachment`
  const fileName = decodeURIComponent(new URL(fileUrl).pathname.split('/').pop() || '')

  downloadFileFromUrl(fileUrl, fileName)
}

/**
 * 判断一个 URL 是否为 FileId
 */
export const isFileId = (v: string) => /^cloud:\/\/\S+/.test(v)

export const getFileNameFromUrl = (url: string) => {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname || ''
    return pathname.split('/').pop()
  } catch (error) {
    // 直接 split
    return url.split('/').pop() || ''
  }
}

export function fileIdToUrl(fileID: string) {
  if (!fileID) {
    return ''
  }

  // 非 fileId
  if (!/^cloud:\/\//.test(fileID)) {
    return fileID
  }

  // cloudId: cloud://cms-demo.636d-cms-demo-1252710547/cloudbase-cms/upload/2020-09-15/Psa3R3NA4rubCd_R-favicon-wx.svg
  let link = fileID.replace('cloud://', '')
  // 文件路径
  const index = link.indexOf('/')
  // envId.bucket
  const prefix = link.slice(0, index)
  // [envId, bucket]
  const splitPrefix = prefix.split('.')

  // path 路径
  const path = link.slice(index + 1)

  let envId
  let trimBucket
  if (splitPrefix.length === 1) {
    trimBucket = splitPrefix[0]
  } else if (splitPrefix.length === 2) {
    envId = splitPrefix[0]
    trimBucket = splitPrefix[1]
  }

  if (envId) {
    envId = envId.trim()
  }

  return `https://${trimBucket}.tcb.qcloud.la/${path}`
}

/**
 * 获取 HTTP 访问地址
 */
export const getHttpAccessPath = () => {
  return isDevEnv()
    ? defaultSettings.globalPrefix
    : SERVER_MODE
    ? `https://${cmsConfig.containerAccessPath}${defaultSettings.globalPrefix}`
    : `https://${cmsConfig.cloudAccessPath}${defaultSettings.globalPrefix}`
}
