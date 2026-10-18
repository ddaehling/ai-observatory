#!/bin/zsh
# Double-click to open a terminal with the local controls URL.
set -eu
project_dir="${0:A:h}"
cd "$project_dir"
exec python3 "$project_dir/scripts/control_panel.py"
