create policy messages_select_member on realtime.messages
for select to authenticated
using (
    (
        realtime.messages.extension = 'broadcast'
        and (select realtime.topic()) = 'account:' || (select auth.uid())::text
    )
    or (
        realtime.messages.extension in ('broadcast', 'presence')
        and (select realtime.topic()) in ('board:assembly', 'board:bash', 'chat:global')
    )
);

create policy messages_insert_chat_presence on realtime.messages
for insert to authenticated
with check (realtime.messages.extension = 'presence' and (select realtime.topic()) = 'chat:global');
