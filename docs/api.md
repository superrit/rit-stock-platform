# 接口文档

## 通用说明

- **Base URL**：`http://<host>:3000`（开发环境）
- **内容类型**：`application/json`（除特别说明外）
- **错误返回格式**：
  ```json
  { "error": true, "statusCode": 400, "message": "错误描述" }
  ```
- **鉴权方式**：需要登录态的接口，令牌存于 httpOnly cookie `rit_token`（登录后自动携带）；也可通过请求头 `Authorization: Bearer <token>` 传递。

---

## 1. 获取 RSA 公钥

客户端用此公钥对敏感数据做 **RSA-OAEP(SHA-256)** 加密后上传，后端用核心私钥解密。

- **方法**：`GET`
- **路径**：`/api/rsa/public-key`
- **鉴权**：无（公开接口）

**响应示例**：

```json
{
  "algorithm": "RSA-OAEP-256",
  "keySize": 2048,
  "padding": "oaep-sha256",
  "publicKey": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n"
}
```

**说明**：加密使用 `RSA_PKCS1_OAEP_PADDING` + `sha256`；密文以 base64 传给后端，后端用私钥解密（已内置 `decryptWithPrivateKey` 工具，供后续接口复用）。

---

## 2. 股票分析策略上报

批量上报策略分析结果，`hash` 唯一，重复上报覆盖。

- **方法**：`POST`
- **路径**：`/api/strategy/report`
- **鉴权**：无（依赖 **MD5 签名** + **时间戳防重放**）

**请求体**：

```json
{
  "ts": "132156456456",
  "data": [
    {
      "hash": "3fdsfdsafsdaewrqr",
      "udStr": "01110",
      "stockNumber": "002578.SZ",
      "stockName": "闽发铝业",
      "nextIndex": 2915,
      "direct": "1",
      "price": 4.5,
      "tp": 0.58,
      "sl": 0.29,
      "pl": 0.18,
      "result": "{\"0\": 47.5,\"1\": 49.53,\"2\": 2.98}",
      "ratio": 49.53,
      "total": 101343,
      "period": "day",
      "tacticResolveTime": "2024-01-03T00:00:00+08:00",
      "BSP": 4.46,
      "JXP": 4.45,
      "CalcCha": "{\"less\": 30.67,\"mean\": 55.98,\"middle\": 41.97,\"more\": 56.38}",
      "mustEles": "[\"K1.C>=K3.C\",\"K1.C>=K4.C\"]",
      "scoreDetail": "{\"N\": \"0.2907,1.2333,-6.7667,0.8\"}",
      "analyzeScore": 4.63923
    }
  ],
  "sign": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

**字段说明（data 数组内每条）**：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| hash | string | 策略 hash（唯一索引，冲突则覆盖） |
| udStr | string | udStr |
| stockNumber | string | 股票代码 |
| stockName | string | 股票名称 |
| nextIndex | int | 股票 K 线索引 |
| direct | string | 方向 |
| price | number | 开仓价格 |
| tp | number | 止盈 |
| sl | number | 止损 |
| pl | number | 平保 |
| result | string | 统计结果（JSON 字符串） |
| ratio | number | 最终比例 |
| total | int | 结果订单数 |
| period | string | 策略周期 |
| tacticResolveTime | string | 分析时间（ISO 8601） |
| BSP | number | 保守进场价 |
| JXP | number | 极限进场价 |
| CalcCha | string | 统计结果（JSON 字符串） |
| mustEles | string | 统计特征（JSON 字符串） |
| scoreDetail | string | 分数详情（JSON 字符串） |
| analyzeScore | number | 分析分数 |

**签名规则（sign）**：

```
sign = MD5( ts + JSON.stringify(data) + 32位盐值 )
```

- `ts` 与请求体中的 `ts` 完全一致（字符串拼接）。
- `JSON.stringify(data)` 为对 `data` 数组的序列化（与服务端反序列化后重新序列化结果一致，需保持字段顺序一致、无多余空白）。
- 32 位盐值配置在服务端 `NUXT_SIGN_SALT`，客户端需持有相同盐值。
- `sign` 为 32 位小写十六进制 MD5。

**防重放**：`ts` 与服务器当前时间的偏差不能超过 `NUXT_REPLAY_WINDOW_MS`（默认 300000ms = 5 分钟），否则返回 400「时间戳已过期」。`ts` 支持 13 位毫秒或 10 位秒时间戳。

**响应示例**：

```json
{ "success": true, "saved": 2000 }
```

**注意**：`data` 单次最多上报约 2000 条，服务端按 500 条分片、事务内批量 upsert。

---

## 3. 用户登录记录查询（仅管理员）

- **方法**：`GET`
- **路径**：`/api/login-records`
- **鉴权**：`super_admin`

**查询参数**：

| 参数 | 说明 | 默认 |
| --- | --- | --- |
| page | 页码（从 1 开始） | 1 |
| pageSize | 每页条数（最大 100） | 20 |

**响应示例**：

```json
{
  "records": [
    { "id": 1, "phone": "13800000000", "ip": "127.0.0.1", "device": "Mozilla/5.0 ...", "login_at": "2026-10-05T05:00:00.000Z" }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20
}
```

**说明**：登录成功后记录登录时间、IP、设备（User-Agent）、手机号；记录仅保留 **6 个月**（登录时顺带清理过期记录）。

---

## 4. VIP 续期操作记录查询（仅管理员）

- **方法**：`GET`
- **路径**：`/api/vip-records`
- **鉴权**：`super_admin`

**查询参数**：同「登录记录查询」。

**响应示例**：

```json
{
  "records": [
    { "id": 1, "operator_phone": "13800000000", "target_phone": "13800000002", "duration": "半年", "months": 6, "operated_at": "2026-10-05T05:00:00.000Z" }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20
}
```

---

## 5. VIP 续期（仅管理员）

延长用户 VIP 有效期。**延长类型必须使用统一枚举，前端不可自由上送时长**，防止越权/超长续期。

- **方法**：`POST`
- **路径**：`/api/users/:id/vip`
- **鉴权**：`super_admin`

**请求体**：

```json
{ "duration": "1month" }
```

**duration 枚举值**：

| 枚举值 | 含义 | 月数 |
| --- | --- | --- |
| 1month | 1 个月 | 1 |
| 3months | 3 个月 | 3 |
| 6months | 半年 | 6 |
| 1year | 1 年 | 12 |

**续期规则**：若用户当前仍在 VIP 有效期内，则从当前到期时间顺延；否则从当前时间起算。

**响应示例**：

```json
{
  "user": {
    "id": 3,
    "phone": "13800000002",
    "role": "vip",
    "isVip": true,
    "vipExpireAt": "2026-11-04T05:00:00.000Z",
    "vipRemainingDays": 30
  },
  "duration": "1个月",
  "months": 1
}
```

**说明**：每次续期都会写入操作记录表，记录「操作时间、延长类型、操作人手机号、被修改人手机号」。

---

## 2.1 策略分页查询（登录用户）

查询已上报的策略数据。**字段按角色裁剪**：普通用户仅返回基础字段，VIP/超级管理员返回全部字段（含 `udStr/mustEles/scoreDetail/analyzeScore`）。

- **方法**：`GET`
- **路径**：`/api/strategy/reports`
- **鉴权**：登录用户（普通用户/VIP/超管均可）

**查询参数**：

| 参数 | 说明 | 默认 |
| --- | --- | --- |
| page | 页码 | 1 |
| pageSize | 每页条数（最大 100） | 20 |
| sortBy | 排序字段（见下） | tacticResolveTime |
| sortOrder | `asc` / `desc` | desc |
| stockNumber | 股票代码，模糊匹配 | - |
| stockName | 股票名称，模糊匹配 | - |
| direct | 方向，精确匹配（下拉可选值由 `directs` 返回） | - |
| tacticResolveTimeFrom | 分析时间起（YYYY-MM-DD，含当天） | - |
| tacticResolveTimeTo | 分析时间止（YYYY-MM-DD，含当天） | - |

**可排序字段**：`hash / stockNumber / stockName / nextIndex / direct / price / tp / sl / pl / ratio / total / period / tacticResolveTime / BSP / JXP / analyzeScore / createdAt`

**响应示例**：

```json
{
  "records": [
    {
      "hash": "seedhash1", "stockNumber": "002578.SZ", "stockName": "闽发铝业",
      "nextIndex": 100, "direct": "1", "price": 10, "tp": 0.5, "sl": 0.25, "pl": 0.15,
      "result": "{\"0\":40,...}", "ratio": 45, "total": 1000, "period": "day",
      "tacticResolveTime": "2024-01-02T16:00:00.000Z", "BSP": 9.5, "JXP": 9.4, "CalcCha": "{...}"
    }
  ],
  "total": 6, "page": 1, "pageSize": 20, "directs": ["1", "2"]
}
```

**字段可见性**：

| 字段 | 普通用户 | VIP/超管 |
| --- | --- | --- |
| hash/stockNumber/stockName/nextIndex/direct/price/tp/sl/pl/result/ratio/total/period/tacticResolveTime/BSP/JXP/CalcCha | ✅ | ✅ |
| udStr/mustEles/scoreDetail/analyzeScore | ❌ | ✅ |

---

## 附：相关端点索引

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| GET | /api/rsa/public-key | 无 | 获取 RSA 公钥 |
| POST | /api/strategy/report | 签名 | 策略分析上报 |
| GET | /api/login-records | 管理员 | 登录记录分页查询 |
| GET | /api/vip-records | 管理员 | VIP 操作记录分页查询 |
| POST | /api/users/:id/vip | 管理员 | VIP 续期（枚举） |
| GET | /api/strategy/reports | 登录用户 | 策略分页查询（按角色裁剪字段） |
| GET | /api/users | 管理员 | 用户列表 |
| POST | /api/users | 管理员 | 新增用户 |
| PATCH | /api/users/:id | 管理员 | 修改备注 |
| DELETE | /api/users/:id | 管理员 | 删除用户 |
| POST | /api/auth/login | 无 | 登录 |
| POST | /api/auth/change-password | 改密令牌 | 修改密码 |
| POST | /api/auth/logout | 登录态 | 退出登录 |
| GET | /api/auth/me | 登录态 | 当前用户信息 |
| GET | /api/health | 无 | 健康检查 |
