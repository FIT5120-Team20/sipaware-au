# Epic5 后台提醒部署与验收

## 当前实现及实际限制

代码包含权限说明、浏览器推送订阅、后台启用/更新/停用、状态同步、定时处理入口、Web Push 发送适配器、通知显示与点击。
代码完成不代表上线完成。当前没有真实提醒数据库、线上密钥或 Scheduler，且本机 pywebpush 安装受临时目录权限限制。所有测试中的发送和数据库均为模拟，真实 PostgreSQL 并发与设备收件仍必须验收。

每日策略：开启的订阅持续有效，不要求当天打开网页或最近10分钟同步。按保存的设备时区到点后，只有当天已同步的成功打卡才取消当天提醒；昨天打卡不会取消今天提醒。离线打卡未同步时仍可能收到通知，所以通知使用“如果今天还没打卡”的条件文案。设备权限、网络和订阅有效性仍影响实际收件。
发送前提交唯一日期占位。发送超时或进程崩溃可能漏提醒，当天不自动重试，以免重复。服务商接受不等于设备显示。发送已被服务商接受后，再停用不能撤回消息。
时间建议目前仍只保存偏好，需进入提醒设置点击启用/更新才应用到后台；尚不满足“接受建议直接启用/更新”的最终交互要求。

## 1 安装后台依赖

在项目根目录的 VS Code 终端运行：

```powershell
uv pip install --python backend/.venv/Scripts/python.exe -r backend/requirements.txt
backend/.venv/Scripts/python.exe backend/scripts/generate_reminder_keys.py
```

密钥写入 gitignored 的 backend/.env.reminder.generated，命令不会打印密钥。已有文件时拒绝覆盖。私钥只放后台；不要把这个文件提交或贴入聊天。

## 2 数据库

为提醒使用独立可写 PostgreSQL，不能复用公共目录只读账号。
由数据库负责人依次执行 backend/migrations/001_reminders.sql 和 002_reminder_delivery.sql。
后台业务账号只需要对应表的 SELECT/INSERT/UPDATE，不需要建表权限。
连接写入 REMINDER_DATABASE_URL；没有配置时返回不可用，不影响个人本地记录。

## 3 环境变量

本地放 backend/.env，线上放 Vercel backend 环境变量：
- REMINDER_DATABASE_URL
- REMINDER_VAPID_PUBLIC_KEY
- REMINDER_VAPID_PRIVATE_KEY
- REMINDER_VAPID_SUBJECT：维护人的 mailto: 地址
- REMINDER_CRON_SECRET：随机独立密钥
- REMINDER_DELIVERY_READY：默认0，完成配置并安排 Scheduler 后设1

Vercel 的 Middleware 环境也必须能够读取同一个 REMINDER_CRON_SECRET。
只有 POST /iteration3/api/reminders/dispatch 且 Bearer 密钥正确时可越过课堂登录 cookie；后台仍会再次鉴权。其他页面/API 继续使用原课堂访问控制。
后台接口沿用 current-device 随机 bearer token，不使用账户；浏览器保存 token，后台仅存其 hash。

## 4 cron-job.org

任务 URL：https://团队生产域名/iteration3/api/reminders/dispatch
方法 POST；每5分钟；请求头 Authorization: Bearer <REMINDER_CRON_SECRET>。
密钥只存 Scheduler 账户与服务器环境，不能放 URL、GitHub 或前端。
若 Vercel 的平台 Deployment Protection 也拦截此调用，须由项目拥有者配置官方自动化访问方式；不应关闭整个站点保护。
每次最多处理10个设备，单次发送超时8秒。容量增加时必须调整任务预算与队列，不适合未经评估直接大规模使用。
需要上线前为订阅写入端点配置服务端/WAF限流并检查请求体上限；应用当前没有通用账户风控。

## 5 网页开启与取消

Home → Recording reminder settings → 权限说明 → 用户授权。
选时间 → Enable background reminder；成功响应后才显示已开启。
当前页面会明示同步最小数据：设备订阅、时间、时区、日期级打卡状态，不上传酒名、饮酒量或 Awards。
Update active reminder 应用新时间/当前设备时区；Disable background reminder 先确认后台停用，再取消浏览器订阅。
本地数据修改后触发同步；失败保留本地启用意图，重新在线、重新聚焦、可见及每分钟会读最新数据重试。递增 revision 阻止旧网络请求覆盖新状态。
手机或设备更换时区后，应重新应用提醒设置；不自动猜测用户想保留原时区还是跟随设备。

## 6 真实设备验收

1. Android Chrome 或桌面 Chrome/Edge 开启提醒，设为几分钟后。
2. 确认今天尚未打卡，关闭页面超过10分钟，等待正式 Scheduler 触发；第二天不打开网页，再验证仍能收到提醒。
3. 验证通知显示，点击进入 /iteration3/#todays-check-in，不创建饮酒记录。
4. 同一天重复调度只出现一次发送占位；并发调用也应验证真实数据库唯一约束。
5. 分别测试保存饮酒记录和 No alcohol 后同步，确认不发送。
6. 停用、更新时间、过期订阅404/410、网络断开、时间跨日与夏令时。
7. 超过10分钟不再同步时必须跳过，并在验收记录中明确这是保守策略带来的漏发。
8. iOS 主屏幕安装需要额外 manifest/图标和实机验收，当前不能宣称支持已验收。

## 7 自动化检查

frontend：npm test -- --configLoader native --pool threads --maxWorkers 2；npm run lint；npm run build -- --configLoader native。
backend：.venv/Scripts/python.exe -m pytest -q -p no:cacheprovider。
项目根目录：node tests/epic5/frontend/reminderScheduler.test.mjs；node tests/epic5/frontend/reminderWorker.test.mjs。

安全测试覆盖 Scheduler 密钥错误、精确路径限制、通知固定跳转、配置未就绪、过期状态跳过与操作失败界面。
所有生产发送、数据库并发和本机依赖安装问题解决前，请保留开发分支，不按“Epic5 已完成”提交验收。
