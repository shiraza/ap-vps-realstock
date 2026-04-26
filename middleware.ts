import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // リクエストヘッダーから authorization を取得
  const basicAuth = request.headers.get('authorization');

  if (basicAuth) {
    // "Basic base64encodedstring" からエンコードされた部分を取り出す
    const authValue = basicAuth.split(' ')[1];
    if (authValue) {
      // Base64デコードしてユーザー名とパスワードを抽出
      const decoded = atob(authValue);
      const [user, password] = decoded.split(':');

      // 環境変数に設定されたユーザー名・パスワードと照合
      if (
        user === process.env.ADMIN_USER &&
        password === process.env.ADMIN_PASSWORD
      ) {
        // 認証成功時はそのまま処理を継続
        return NextResponse.next();
      }
    }
  }

  // 認証情報がない、または認証に失敗した場合は401エラーとダイアログ表示を要求
  return new NextResponse('認証が必要です', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area"',
    },
  });
}

// /admin とその配下すべてにミドルウェアを適用
export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
