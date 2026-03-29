do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'api_tokens'
      and column_name = 'project_id'
      and data_type = 'text'
  ) then
    alter table api_tokens drop constraint if exists api_tokens_project_id_fkey;
    alter table api_tokens
      alter column project_id type uuid
      using project_id::uuid;
    alter table api_tokens
      add constraint api_tokens_project_id_fkey
      foreign key (project_id) references projects(id) on delete cascade;
  end if;
end $$;
