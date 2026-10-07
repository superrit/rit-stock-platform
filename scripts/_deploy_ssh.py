#!/usr/bin/env python3
"""部署辅助脚本：读取 .env.production 中的 SSH 配置，执行远程命令 / 上传文件。

用法：
  python _deploy_ssh.py run "远程命令"
  python _deploy_ssh.py put <本地路径> <远程路径>   # 本地为文件或目录
  python _deploy_ssh.py put <本地路径> <远程路径> --mode 0644
"""
import os
import sys
import stat
import argparse
import paramiko

HERE = os.path.dirname(os.path.abspath(__file__))
ENV_FILE = os.path.join(HERE, '..', '.env.production')


def load_env(path):
    env = {}
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            k = k.strip()
            v = v.strip()
            if len(v) >= 2 and v[0] == v[-1] and v[0] in ('"', "'"):
                v = v[1:-1]
            env[k] = v
    return env


def connect(env):
    host = env['SSH_SERVE']
    port = int(env.get('SSH_PORT', '22'))
    user = env['SSH_USER']
    pw = env.get('SSH_PASSWORD', '')
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, port=port, username=user, password=pw,
                   timeout=20, look_for_keys=False, allow_agent=False,
                   banner_timeout=20, auth_timeout=20)
    return client


def cmd_run(env, command):
    client = connect(env)
    try:
        stdin, stdout, stderr = client.exec_command(command, timeout=1800, get_pty=False)
        # 实时输出
        out_chunks = []
        while True:
            line = stdout.readline()
            if not line:
                break
            sys.stdout.write(line)
            sys.stdout.flush()
            out_chunks.append(line)
        rc = stdout.channel.recv_exit_status()
        err = stderr.read().decode('utf-8', 'replace')
        if err:
            sys.stderr.write(err)
        return rc
    finally:
        client.close()


def sftp_put_recursive(sftp, local, remote, mode):
    if os.path.isdir(local):
        try:
            sftp.stat(remote)
        except IOError:
            sftp.mkdir(remote)
        for name in os.listdir(local):
            sftp_put_recursive(sftp, os.path.join(local, name),
                               remote + '/' + name, mode)
    else:
        sftp.put(local, remote)
        if mode:
            sftp.chmod(remote, mode)


def cmd_put(env, local, remote, mode):
    local = os.path.abspath(local)
    client = connect(env)
    try:
        sftp = client.open_sftp()
        # 确保远程父目录存在
        parent = remote.rsplit('/', 1)[0] if '/' in remote else '.'
        try:
            sftp.mkdir(parent)
        except IOError:
            pass
        sftp_put_recursive(sftp, local, remote, mode)
        sftp.close()
        print(f'UPLOAD_OK {local} -> {remote}')
    finally:
        client.close()


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    p_run = sub.add_parser('run')
    p_run.add_argument('command')
    p_put = sub.add_parser('put')
    p_put.add_argument('local')
    p_put.add_argument('remote')
    p_put.add_argument('--mode', default='')
    args = ap.parse_args()

    env = load_env(ENV_FILE)
    if args.cmd == 'run':
        rc = cmd_run(env, args.command)
        sys.exit(rc)
    elif args.cmd == 'put':
        cmd_put(env, args.local, args.remote, args.mode)


if __name__ == '__main__':
    main()
