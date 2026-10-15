'use strict';
/*
  Publish: build -> summary -> git add -> commit -> push.
  Started by publish.bat. All messages are in Vietnamese on purpose.
*/
const { spawnSync } = require('child_process');
const path = require('path');
const { build } = require('./build');

const ROOT = path.resolve(__dirname, '..');
const BRANCH = 'main';

function git(args, opts = {}) {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '1' }, ...opts });
  return { code: r.status, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}
const line = () => console.log('─'.repeat(60));

function pagesUrl() {
  const u = git(['remote', 'get-url', 'origin']).out;
  const m = /github\.com[:/]+([^/]+)\/([^/.]+)(?:\.git)?\/?$/i.exec(u);
  return m ? `https://${m[1].toLowerCase()}.github.io/${m[2]}/` : null;
}

function explainPushError(text) {
  const t = text.toLowerCase();
  if (/could not resolve host|unable to access|network is unreachable|timed out/.test(t))
    return 'Máy không kết nối được tới GitHub. Hãy kiểm tra Internet (Wi-Fi) rồi chạy lại publish.bat.';
  if (/403|permission to .* denied|access denied/.test(t))
    return 'Tài khoản GitHub đang đăng nhập chưa có quyền ghi vào repo này.\n   - Nếu repo của thầy: nhờ thầy mời bạn làm Collaborator (Settings → Collaborators) và bạn bấm chấp nhận lời mời trong email.\n   - Nếu đăng nhập nhầm tài khoản: mở "Credential Manager" của Windows, xoá mục github.com rồi chạy lại để đăng nhập lại.';
  if (/authentication failed|could not read username|invalid username or password|terminal prompts disabled/.test(t))
    return 'Chưa đăng nhập GitHub (hoặc đăng nhập hết hạn). Chạy lại publish.bat, khi cửa sổ đăng nhập GitHub hiện ra thì bấm "Sign in with your browser".';
  if (/repository not found/.test(t))
    return 'Không tìm thấy repo trên GitHub. Kiểm tra lại địa chỉ repo (lệnh: git remote -v) hoặc bạn chưa có quyền truy cập.';
  if (/rejected|non-fast-forward|fetch first/.test(t))
    return 'Trên GitHub có thay đổi mới mà máy bạn chưa có (có thể người khác vừa đăng). Chưa thể tự gộp.';
  if (/large|exceeds|100 mb/.test(t))
    return 'Có file quá lớn (trên 100 MB) nên GitHub từ chối. Hãy xoá/giảm file đó trong thư mục content/ rồi chạy lại.';
  return 'Lỗi chưa rõ. Hãy chụp màn hình toàn bộ cửa sổ này gửi cho người hỗ trợ.';
}

(async () => {
  console.log('\n=== GEOF · Đăng website lên GitHub ===\n');

  if (git(['--version']).code !== 0) { console.log('⛔ Máy chưa cài Git. Tải tại https://git-scm.com/download/win rồi chạy lại.'); process.exit(1); }
  if (git(['rev-parse', '--is-inside-work-tree']).code !== 0) { console.log('⛔ Thư mục này chưa phải kho Git. Hãy nhờ Claude Code chạy lại phần "Kết nối GitHub".'); process.exit(1); }
  if (!git(['remote', 'get-url', 'origin']).out) { console.log('⛔ Chưa kết nối với GitHub (chưa có remote origin). Hãy nhờ Claude Code thiết lập lại.'); process.exit(1); }

  console.log('1/4  Kiểm tra nội dung và nén ảnh...');
  const r = await build();
  if (!r.ok) {
    console.log('\n⛔ DỪNG LẠI: nội dung có lỗi. Website trên mạng vẫn giữ nguyên, CHƯA đăng gì cả.\n');
    r.errors.forEach(e => console.log(e + '\n'));
    process.exit(1);
  }

  console.log('\n2/4  Tóm tắt thay đổi:');
  git(['add', '-A']);
  const status = git(['status', '--porcelain']).out;
  if (!status) {
    line();
    console.log('✔ Không có gì mới. Website đã là bản mới nhất.');
    const u = pagesUrl(); if (u) console.log('  Link web: ' + u);
    process.exit(0);
  }
  const files = status.split('\n');
  const n = (re, st) => files.filter(l => re.test(l.slice(3)) && (!st || l[0] === st)).length;
  console.log(`   • Ảnh trên web: ${n(/^assets\//, 'A')} thêm mới, ${n(/^assets\//, 'M')} cập nhật, ${n(/^assets\//, 'D')} xoá`);
  console.log(`   • Tổng số file thay đổi: ${files.length}`);
  console.log(`   • Nội dung: ${r.summary || 'chỉnh sửa nhỏ'}`);
  if (r.warnings.length) { console.log('\n   Cảnh báo (không chặn việc đăng):'); r.warnings.forEach(w => console.log('   ' + w)); }

  const msg = 'Update content: ' + (r.summary || 'minor edits');
  console.log('\n3/4  Lưu phiên bản: "' + msg + '"');
  const c = git(['commit', '-m', msg]);
  if (c.code !== 0) { console.log('⛔ Không lưu được phiên bản (commit).\n' + (c.err || c.out)); process.exit(1); }

  console.log('4/4  Đăng lên GitHub (nếu có cửa sổ đăng nhập hiện ra, hãy đăng nhập)...');
  let p = git(['push', '-u', 'origin', BRANCH]);
  if (p.code !== 0 && /rejected|non-fast-forward|fetch first/i.test(p.err)) {
    console.log('   GitHub có thay đổi mới, đang thử gộp tự động...');
    const pr = git(['pull', '--rebase', 'origin', BRANCH]);
    if (pr.code === 0) p = git(['push', '-u', 'origin', BRANCH]);
    else { git(['rebase', '--abort']); p = { code: 1, err: pr.err + ' rejected', out: '' }; console.log('   Không gộp tự động được.'); }
  }
  line();
  if (p.code !== 0) {
    console.log('⛔ ĐĂNG KHÔNG THÀNH CÔNG.\n');
    console.log('   Nguyên nhân: ' + explainPushError(p.err + ' ' + p.out));
    console.log('\n   (Thay đổi đã được lưu trên máy, bạn chạy lại publish.bat sau khi xử lý là đăng được.)');
    console.log('\n   Chi tiết kỹ thuật:\n   ' + p.err.split('\n').join('\n   '));
    process.exit(1);
  }
  console.log('✅ ĐÃ ĐĂNG THÀNH CÔNG!');
  const u = pagesUrl();
  if (u) console.log('\n   Link web: ' + u);
  console.log('   Hãy đợi 1-2 phút để GitHub cập nhật, rồi bấm Ctrl+F5 trên trình duyệt để xem bản mới.');
})().catch(e => { console.log('⛔ Lỗi không mong đợi: ' + e.message); process.exit(1); });
