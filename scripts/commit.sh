#!/usr/bin/env bash
# 이 파일이 하는 일: 커밋 메시지 끝에 공동 작성자 표기를 붙여 커밋한다 (개발용)
set -e
git add -A
git commit -q -F - <<MSG
$1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S1rTteTJYFRcBQNAW1aBGy
MSG
