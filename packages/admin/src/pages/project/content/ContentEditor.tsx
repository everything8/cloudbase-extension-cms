import React, { useState } from 'react'
import { useConcent } from 'concent'
import { useParams, useRequest, history } from 'umi'
import { Form, message, Space, Button, Row, Col, Input, Typography } from 'antd'
import { createContent, setContent } from '@/services/content'
import { getFieldFormItem } from '@/components/Fields'
import ProCard from '@ant-design/pro-card'
import { PageContainer } from '@ant-design/pro-layout'
import { LeftCircleTwoTone } from '@ant-design/icons'
import { getDocInitialValues } from '@/utils'

const { Text } = Typography

const ContentEditor: React.FC = () => {
  const { schemaId, projectId } = useParams<any>()
  const ctx = useConcent('content')
  const { selectedContent, contentAction } = ctx.state
  const {
    state: { schemas, currentSchema },
  } = ctx

  /**
   * 记录变更的内容
   * 1. 只更新变化的字段，防止多端操作时互相覆盖
   * 2. JSON 更新时要整个替换，确保删除的字段也会从数据库删除
   *   （update 时，不会删除对象中缺失的字段）
   */
  const [changedValues, setChangedValues] = useState({})

  const schema: Schema = schemas?.find((item: Schema) => item._id === schemaId) || currentSchema

  // 表单初始值
  const initialValues = getDocInitialValues(contentAction, schema, selectedContent)

  // 创建/更新内容
  const { run, loading } = useRequest(
    async (payload: any) => {
      if (contentAction === 'create') {
        await createContent(projectId, schema?.collectionName, payload)
      }

      if (contentAction === 'edit') {
        // 只更新变更过的字段
        await setContent(projectId, schema?.collectionName, selectedContent._id, changedValues)
      }
    },
    {
      manual: true,
      onError: () => {
        message.error(`${contentAction === 'create' ? '新建' : '更新'}内容失败`)
      },
      onSuccess: () => {
        message.success(`${contentAction === 'create' ? '新建' : '更新'}内容成功`)
        // 返回
        history.goBack()
      },
    }
  )

  return (
    <PageContainer
      title={`${contentAction === 'create' ? '创建' : '更新'}【${schema?.displayName}】内容`}
    >
      <Row>
        <Col
          md={{ span: 24, offset: 0 }}
          lg={{ span: 20, offset: 2 }}
          xl={{ span: 18, offset: 3 }}
          xxl={{ span: 16, offset: 4 }}
        >
          <div style={{ cursor: 'pointer' }} onClick={() => history.goBack()}>
            <Space align="center" style={{ marginBottom: '10px' }}>
              <LeftCircleTwoTone style={{ fontSize: '20px' }} />
              <h3 style={{ marginBottom: '0.25rem' }}>返回</h3>
            </Space>
          </div>
          <ProCard>
            <Form
              name="basic"
              layout="vertical"
              initialValues={initialValues}
              onFinish={(v = {}) => run(v)}
              onValuesChange={(changed) => {
                setChangedValues({
                  ...changedValues,
                  ...changed,
                })
              }}
            >
              {contentAction === 'edit' && (
                <Form.Item label={<Text strong>文档 Id</Text>} name="_id">
                  <Input type="text" disabled />
                </Form.Item>
              )}

              {schema?.fields
                ?.filter((_) => !_.isSystem)
                .map((filed, index) => getFieldFormItem(filed, index))}

              <Form.Item>
                <Row>
                  <Col flex="1 1 auto" style={{ textAlign: 'right' }}>
                    <Space size="large">
                      <Button
                        onClick={() => {
                          history.goBack()
                        }}
                      >
                        取消
                      </Button>
                      <Button type="primary" htmlType="submit" loading={loading}>
                        {contentAction === 'create' ? '创建' : '更新'}
                      </Button>
                    </Space>
                  </Col>
                </Row>
              </Form.Item>
            </Form>
          </ProCard>
        </Col>
      </Row>
    </PageContainer>
  )
}

export default ContentEditor
