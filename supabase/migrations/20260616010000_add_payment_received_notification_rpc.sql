create or replace function public.create_payment_received_notification(
  p_recipient_user_id uuid,
  p_sender_label text,
  p_amount text,
  p_chain text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notification_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  if p_recipient_user_id is null or p_recipient_user_id = auth.uid() then
    return null;
  end if;

  insert into public.notifications (
    user_id,
    type,
    title,
    body,
    status,
    metadata
  )
  values (
    p_recipient_user_id,
    'payment_received',
    'You received USDC',
    format(
      '%s sent you %s USDC on %s.',
      coalesce(nullif(trim(p_sender_label), ''), 'PayCMD user'),
      p_amount,
      coalesce(nullif(trim(p_chain), ''), 'PayCMD')
    ),
    'unread',
    jsonb_build_object(
      'senderUserId', auth.uid(),
      'amount', p_amount,
      'chain', p_chain
    ) || coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

revoke all on function public.create_payment_received_notification(uuid, text, text, text, jsonb) from public;
grant execute on function public.create_payment_received_notification(uuid, text, text, text, jsonb) to authenticated;
