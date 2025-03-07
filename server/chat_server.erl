-module(chat_server).
-behaviour(gen_server).

-export([start_link/0, init/1, handle_call/3, handle_cast/2, handle_info/2, terminate/2, code_change/3]).
-export([send_message/3, join_group/2, leave_group/2]).

-record(state, {clients = #{}, groups = #{}}).

start_link() ->
    gen_server:start_link({local, ?MODULE}, ?MODULE, [], []).

init([]) ->
    {ok, #state{}}.

handle_call({join_group, ClientId, GroupName}, _From, State) ->
    NewGroups = maps:update_with(GroupName, fun(Clients) -> [ClientId | Clients] end, [ClientId], State#state.groups),
    {reply, ok, State#state{groups = NewGroups}};

handle_call({leave_group, ClientId, GroupName}, _From, State) ->
    NewGroups = maps:update_with(GroupName, fun(Clients) -> lists:delete(ClientId, Clients) end, State#state.groups),
    {reply, ok, State#state{groups = NewGroups}};

handle_call(_Request, _From, State) ->
    {reply, ok, State}.

handle_cast({send_message, Message, GroupName}, State) ->
    case maps:find(GroupName, State#state.groups) of
        {ok, Clients} ->
            [gen_server:cast({global, ClientId}, {new_message, Message}) || ClientId <- Clients];
        error ->
            ok
    end,
    {noreply, State};

handle_cast(_Msg, State) ->
    {noreply, State}.

handle_info(_Info, State) ->
    {noreply, State}.

terminate(_Reason, _State) ->
    ok.

code_change(_OldVsn, State, _Extra) ->
    {ok, State}.

% API
send_message(Message, GroupName, State) ->
    gen_server:cast(?MODULE, {send_message, Message, GroupName}).

join_group(ClientId, GroupName) ->
    gen_server:call(?MODULE, {join_group, ClientId, GroupName}).

leave_group(ClientId, GroupName) ->
    gen_server:call(?MODULE, {leave_group, ClientId, GroupName}).