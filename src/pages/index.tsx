import Head from 'next/head';

export default function Home() {
  const serverInfo = {
    version: '3.0',
    status: '运行中',
    api: '/api/v2',
    features: [
      '设备自动检测',
      '智能图片格式优化',
      '多格式支持 (JPEG, WebP, AVIF)',
      '外链模式',
      'JSON/Text 格式输出',
      '重定向支持'
    ]
  };

  return (
    <div className="container">
      <Head>
        <title>PicFlow API</title>
        <meta name="description" content="PicFlow API - 智能图片服务" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        <h1>PicFlow API</h1>
        <div className="status">✅ {serverInfo.status}</div>
        
        <div className="info-section">
          <h2>API 信息</h2>
          <div className="info-item">
            <span className="label">版本</span>
            <span className="value">{serverInfo.version}</span>
          </div>
          <div className="info-item">
            <span className="label">API 端点</span>
            <span className="value">{serverInfo.api}</span>
          </div>
        </div>

        <div className="features-section">
          <h2>功能特性</h2>
          <ul className="features-list">
            {serverInfo.features.map((feature, index) => (
              <li key={index}>{feature}</li>
            ))}
          </ul>
        </div>

        <div className="api-examples">
          <h2>使用示例</h2>
          <div className="example">
            <code>GET {serverInfo.api}?count=5</code>
            <p>获取5张随机图片</p>
          </div>
          <div className="example">
            <code>GET {serverInfo.api}?type=pe&format=webp</code>
            <p>获取移动端WebP格式图片</p>
          </div>
          <div className="example">
            <code>GET {serverInfo.api}?external=true</code>
            <p>使用外链模式</p>
          </div>
        </div>
      </main>

      <style jsx global>{`
        body {
          font-family: Arial, sans-serif;
          max-width: 800px;
          margin: 50px auto;
          padding: 20px;
          background: #f5f5f5;
        }
        .container {
          background: white;
          padding: 30px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
          color: #333;
          text-align: center;
          margin-bottom: 30px;
        }
        .status {
          text-align: center;
          color: #28a745;
          font-size: 18px;
          margin-bottom: 20px;
        }
        .info-section,
        .features-section,
        .api-examples {
          margin: 30px 0;
        }
        h2 {
          color: #555;
          margin-bottom: 15px;
        }
        .info-item {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid #eee;
        }
        .info-item:last-child {
          border-bottom: none;
        }
        .label {
          font-weight: bold;
          color: #555;
        }
        .value {
          color: #777;
        }
        .features-list {
          list-style: none;
          padding: 0;
        }
        .features-list li {
          padding: 8px 0;
          border-bottom: 1px solid #eee;
        }
        .features-list li:last-child {
          border-bottom: none;
        }
        .api-examples {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 5px;
        }
        .example {
          margin: 15px 0;
        }
        code {
          background: #e9ecef;
          padding: 8px 12px;
          border-radius: 4px;
          display: block;
          margin-bottom: 5px;
          font-family: 'Courier New', monospace;
        }
        p {
          margin: 5px 0 0 0;
          color: #666;
        }
      `}</style>
    </div>
  );
}
