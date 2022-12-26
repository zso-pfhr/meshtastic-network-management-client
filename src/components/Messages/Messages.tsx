import React, { FormEventHandler, ReactNode, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";

import ChatBubble from "@components/Messages/ChatBubble";
import NodeSearchInput from "@components/NodeSearch/NodeSearchInput";
import MapIconButton from "@components/Map/MapIconButton";
import { requestSendMessage } from "@features/device/deviceActions";
import { selectMessagesByChannel } from "@app/features/device/deviceSelectors";

const Messages = () => {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");

  const dispatch = useDispatch();
  const messages = useSelector(selectMessagesByChannel(0)); // TODO replace hard-coded broadcast

  const handleSubmit: FormEventHandler = (e) => {
    e.preventDefault();
    dispatch(requestSendMessage(message));
  };

  return (
    <div
      className="absolute left-9 top-9 w-96 p-4 flex flex-col gap-4"
      style={{ height: "calc(100vh - 72px)" }}
    >
      <div className="flex flex-row gap-4">
        <NodeSearchInput
          query={query}
          setQuery={setQuery}
          placeholder={"Search for messages"}
        />
        <MapIconButton
          className="p-3"
          type="submit"
          onClick={() => alert("Functionality not implemented")}
        >
          <MagnifyingGlassIcon className="w-6 h-6 text-gray-500" />
        </MapIconButton>
      </div>

      <div className="flex flex-1 flex-col rounded-lg w-full h-auto bg-white border-gray-50 drop-shadow justify-top overflow-y-auto">
        <div className="flex flex-col p-6 overflow-scroll gap-4">
          {messages.reduce((accum, message) => {
            if (!("text" in message.payload)) return accum;

            const { data, packet } = message.payload.text;
            const time = new Date(packet.rxTime);

            return [
              ...accum,
              <ChatBubble
                key={time.getMilliseconds()}
                time={time}
                message={data}
                userName={packet.from.toString()}
              />,
            ];
          }, [] as ReactNode[])}
        </div>
        <form className="mt-auto px-6 py-4 bg-gray-100" onSubmit={handleSubmit}>
          <div className="flex flex-row rounded-lg border-gray-100">
            <input
              className="relative z-10 flex-1 px-3 text-gray-900 rounded-l-lg"
              placeholder="Send message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <button className="px-3 py-2 bg-white rounded-r-lg" type="submit">
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Messages;
