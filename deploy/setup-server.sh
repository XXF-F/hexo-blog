#!/bin/bash
# 在服务器上以 root 运行（首次部署）
# 用法: bash setup-server.sh

set -e

echo "==> 安装 Node.js 20..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs git
fi

echo "==> 安装 PM2..."
npm install -g pm2

APP_DIR="${APP_DIR:-/root/hexo-blog}"

if [ ! -d "$APP_DIR" ]; then
  echo "==> 请先克隆项目到 $APP_DIR："
  echo "    git clone https://github.com/xxf-f/hexo-blog.git $APP_DIR"
  exit 1
fi

cd "$APP_DIR"
npm install
cd admin-panel && npm install && cd ..

echo "==> 启动管理后台..."
pm2 delete hexo-admin 2>/dev/null || true
pm2 start admin-panel/server.js --name hexo-admin
pm2 save
pm2 startup | tail -1 | bash || true

echo "==> 放行 4001 端口（如使用 ufw）..."
ufw allow 4001/tcp 2>/dev/null || true

echo ""
echo "✅ 完成！管理后台: http://$(curl -s ifconfig.me 2>/dev/null || echo '你的IP'):4001"
echo "   请立即修改默认密码（账号管理页面）"
