#!/usr/bin/env python3
"""Check thread and agent configuration."""
import asyncio
import sys
sys.path.insert(0, '/app')

from core.services.supabase import DBConnection

async def main():
    thread_id = "4aaa93b3-8e8b-4c39-9dca-3186f651972e"

    db = DBConnection()
    await db.initialize()

    result = await db.client.from_('threads').select('*').eq('id', thread_id).single().execute()

    if result.data:
        print(f'Thread ID: {result.data["id"]}')
        print(f'Agent ID: {result.data.get("agent_id")}')
        print(f'Account ID: {result.data.get("account_id")}')
        print(f'Created at: {result.data.get("created_at")}')

        # Now check the agent
        agent_id = result.data.get('agent_id')
        if agent_id:
            agent_result = await db.client.from_('agents').select('id, name, current_version_id, account_id').eq('id', agent_id).single().execute()
            if agent_result.data:
                print(f'\nAgent: {agent_result.data}')

                # Check agent version
                version_id = agent_result.data.get('current_version_id')
                if version_id:
                    version_result = await db.client.from_('agent_versions').select('version_id, config').eq('version_id', version_id).single().execute()
                    if version_result.data:
                        config = version_result.data.get('config', {})
                        print(f'\nAgent Version Config:')
                        print(f'Model in config: {config.get("model")}')

    await db.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
