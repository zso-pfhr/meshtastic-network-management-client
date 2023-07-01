import React, { ChangeEventHandler, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Map,
  type LngLat,
  NavigationControl,
  ScaleControl,
  MarkerDragEvent,
  useMap,
} from "react-map-gl";
import maplibregl from "maplibre-gl";
import debounce from "lodash.debounce";

import moment from "moment";
import * as Dialog from "@radix-ui/react-dialog";
import * as Select from "@radix-ui/react-select";
import * as Popover from "@radix-ui/react-popover";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Cross2Icon,
} from "@radix-ui/react-icons";
import { Plus, X, Locate } from "lucide-react";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";

import type { app_device_NormalizedWaypoint } from "@bindings/index";

import ConnectionInput from "@components/connection/ConnectionInput";
import { requestSendWaypoint } from "@features/device/deviceActions";
import MeshWaypoint from "@components/Waypoints/MeshWaypoint";
import {
  selectDeviceChannels,
  selectPrimaryDeviceKey,
} from "@features/device/deviceSelectors";
import { selectMapState } from "@features/map/mapSelectors";

import { dateTimeLocalFormatString } from "@utils/form";
import { MapIDs, formatLocation, getFlyToConfig } from "@utils/map";
import { getChannelName } from "@utils/messaging";

import "@components/Map/MapView.css";
import DefaultTooltip from "../DefaultTooltip";

// TODO follow this: https://github.com/missive/emoji-mart/issues/576
export type Emoji = {
  id: string;
  native: string;
  shortcodes: string;
  keywords: string[];
  unified: string;
};

export interface ICreateWaypointDialogProps {
  lngLat: LngLat;
  closeDialog: () => void;
}

const WAYPOINT_NAME_MAX_LEN = 30;
const WAYPOINT_DESC_MAX_LEN = 100;

// Needs to be rendered within a MapProvider component
const CreateWaypointDialog = ({
  lngLat,
  closeDialog,
}: ICreateWaypointDialogProps) => {
  const dispatch = useDispatch();
  const primaryDeviceKey = useSelector(selectPrimaryDeviceKey());
  const deviceChannels = useSelector(selectDeviceChannels());
  const { config } = useSelector(selectMapState());

  const [waypointPosition, setWaypointPosition] = useState<LngLat>(lngLat);
  const { [MapIDs.CreateWaypointDialog]: map } = useMap();

  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState<{ value: string; isValid: boolean }>({
    value: "",
    isValid: true,
  });

  const handleNameChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    const { value } = e.target;
    const isValid = value.length <= WAYPOINT_NAME_MAX_LEN;
    setName({ value, isValid });

    if (!isValid && nameRef.current) {
      nameRef.current.setCustomValidity(
        `Entered name too long (${value.length}/${WAYPOINT_NAME_MAX_LEN})`
      );
    }

    if (isValid && nameRef.current) {
      nameRef.current.setCustomValidity(""); // Make input valid
    }
  };

  const descRef = useRef<HTMLInputElement>(null);
  const [desc, setDesc] = useState<{
    value: string;
    isValid: boolean;
  }>({ value: "", isValid: true });

  const handleDescChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    const { value } = e.target;
    const isValid = value.length <= WAYPOINT_DESC_MAX_LEN;
    setDesc({ value, isValid });

    if (!isValid && descRef.current) {
      descRef.current.setCustomValidity(
        `Entered description too long (${value.length}/${WAYPOINT_DESC_MAX_LEN})`
      );
    }

    if (isValid && descRef.current) {
      descRef.current.setCustomValidity(""); // Make input valid
    }
  };

  const [expireTime, setExpireTime] = useState<string>(
    moment().add(1, "years").format(dateTimeLocalFormatString)
  );

  const [channelNum, setChannelNum] = useState(0);
  const [emoji, setEmoji] = useState<Emoji | null>(null); // TODO will need unicode for this too
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

  const flyToPosition = useMemo(
    () => (pos: LngLat) => map?.flyTo(getFlyToConfig(pos)),
    [getFlyToConfig, map]
  );

  const handlePositionUpdate = useMemo(
    () =>
      debounce<(e: MarkerDragEvent) => void>((e) => {
        setWaypointPosition(e.lngLat);
        flyToPosition(e.lngLat);
      }, 300),
    [map]
  );

  const handleSubmit = () => {
    // Take the emoji and convert it to a base 10 number (unicode bytes)
    const encodedEmoji = parseInt(emoji?.unified ?? "0", 16);

    const createdWaypoint: app_device_NormalizedWaypoint = {
      id: 0, // New waypoint
      latitude: waypointPosition.lat,
      longitude: waypointPosition.lng,
      name: name.value,
      description: desc.value,
      expire: moment(expireTime).valueOf() / 1000, // secs since epoch
      lockedTo: 0, // Not locked
      icon: encodedEmoji, // No icon
    };

    console.warn(createdWaypoint);

    if (!primaryDeviceKey) {
      console.warn("No primary device key port, not creating waypoint");
      return;
    }

    dispatch(
      requestSendWaypoint({
        deviceKey: primaryDeviceKey,
        waypoint: createdWaypoint,
        channel: channelNum,
      })
    );

    closeDialog();
  };

  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 bg-gray-900/[0.4]" />
      <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col bg-white default-overlay">
        <div className="flex flex-row">
          <div className="relative">
            <Map
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: "100%",
                height: "100%",
                borderRadius: "8px 0px 0px 8px",
              }}
              id={MapIDs.CreateWaypointDialog}
              mapStyle={config.style}
              mapLib={maplibregl}
              // interactive={false}
              initialViewState={{
                latitude: waypointPosition.lat,
                longitude: waypointPosition.lng,
                zoom: 12,
              }}
              attributionControl={false}
            >
              <MeshWaypoint
                latitude={waypointPosition.lat}
                longitude={waypointPosition.lng}
                isSelected
                draggable
                onDrag={handlePositionUpdate}
              />

              <ScaleControl
                maxWidth={144}
                position="bottom-right"
                unit="imperial"
              />
              <NavigationControl
                position="bottom-right"
                showCompass
                visualizePitch
              />

              <div className="absolute top-9 right-9 flex bg-white rounded-lg shadow-lg w-10 h-10">
                <DefaultTooltip text="Center waypoint on map">
                  <button
                    type="button"
                    onClick={() => flyToPosition(waypointPosition)}
                    className="m-auto text-gray-700"
                  >
                    <Locate strokeWidth={1} />
                  </button>
                </DefaultTooltip>
              </div>
            </Map>
            <div className=" w-[480px] h-full" />
          </div>

          <div className="flex flex-col gap-4 px-9 py-7">
            <div className="flex flex-col">
              <Dialog.Title className="text-base font-medium text-gray-700">
                Create Waypoint
              </Dialog.Title>

              <Dialog.Description className="text-sm font-normal text-gray-500">
                {formatLocation(waypointPosition.lat)},{" "}
                {formatLocation(waypointPosition.lng)}
              </Dialog.Description>
            </div>

            <fieldset className="">
              <label className="flex flex-col flex-1">
                <p
                  className={`flex flex-row justify-between ${
                    name.isValid ? "text-gray-600" : "text-red-500"
                  }`}
                >
                  <span>Name</span>
                  <span>
                    ({name.value.length}/{WAYPOINT_NAME_MAX_LEN})
                  </span>
                </p>

                <ConnectionInput
                  className="w-full invalid:border-red-400 invalid:text-red-400"
                  placeholder="Enter a title"
                  value={name.value}
                  onChange={handleNameChange}
                  ref={nameRef}
                />
              </label>
            </fieldset>

            <fieldset className="">
              <label className="flex flex-col flex-1">
                <p
                  className={`flex flex-row justify-between ${
                    desc.isValid ? "text-gray-600" : "text-red-500"
                  }`}
                >
                  <span>Description</span>
                  <span>
                    ({desc.value.length}/{WAYPOINT_DESC_MAX_LEN})
                  </span>
                </p>

                <ConnectionInput
                  className="w-full invalid:border-red-400 invalid:text-red-400"
                  placeholder="Enter a description"
                  value={desc.value}
                  onChange={handleDescChange}
                  ref={descRef}
                />
              </label>
            </fieldset>

            <fieldset className="">
              <label className="">
                <p className="text-gray-600">Expire Time</p>
                <ConnectionInput
                  className="w-full"
                  type="datetime-local"
                  min={moment().format(dateTimeLocalFormatString)}
                  value={expireTime}
                  onChange={(e) => setExpireTime(e.target.value)}
                />
              </label>
            </fieldset>

            <fieldset className="">
              <label className="">
                <p className="text-gray-600">Device Channel</p>
                <Select.Root
                  value={`${channelNum}`}
                  onValueChange={(e) => setChannelNum(parseInt(e))}
                >
                  <Select.Trigger
                    className="flex-1 border px-5 py-4 border-gray-400 rounded-lg text-gray-700 h-full bg-transparent focus:outline-none disabled:cursor-wait inline-flex items-center justify-center"
                    aria-label="Channels"
                    asChild
                  >
                    <button>
                      <Select.Value
                        placeholder="Select a channel..."
                        defaultValue={0}
                      />
                      <Select.Icon className="ml-2">
                        <ChevronDownIcon />
                      </Select.Icon>
                    </button>
                  </Select.Trigger>

                  <Select.Portal>
                    <Select.Content className="">
                      <Select.ScrollUpButton className="flex items-center justify-center h-6">
                        <ChevronUpIcon />
                      </Select.ScrollUpButton>

                      <Select.Viewport className="bg-white p-2 rounded-lg shadow-lg">
                        <Select.Group>
                          {deviceChannels.map((c) => (
                            <Select.Item
                              key={c.config.index}
                              value={`${c.config.index}`}
                              className={`relative flex items-center select-none h-6 pl-7 pr-5 py-4 text-gray-700 cursor-pointer radix-disabled:cursor-default radix-disabled:opacity-50`}
                              disabled={c.config.role === 0} // DISABLED role
                            >
                              <Select.ItemText>
                                {getChannelName(c)}
                              </Select.ItemText>
                              <Select.ItemIndicator className="absolute left-0 w-6 inline-flex items-center justify-center">
                                <CheckIcon />
                              </Select.ItemIndicator>
                            </Select.Item>
                          ))}
                        </Select.Group>
                      </Select.Viewport>

                      <Select.ScrollDownButton className="flex items-center justify-center h-6">
                        <ChevronDownIcon />
                      </Select.ScrollDownButton>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
              </label>
            </fieldset>

            <div>
              <p className="text-gray-600">Pin Emoji</p>
              <Popover.Root
                open={isEmojiPickerOpen}
                onOpenChange={(e) => setIsEmojiPickerOpen(e)}
              >
                <div className="flex flex-row">
                  <Popover.Trigger asChild>
                    <div className="relative mr-auto">
                      <button
                        className="relative w-9 h-9 flex align-middle justify-center border border-gray-200 rounded-full"
                        aria-label="Select emoji"
                      >
                        <p className="m-auto text-xl">
                          {emoji?.native ?? (
                            <Plus
                              strokeWidth={1.5}
                              className="text-gray-400 p-0.5"
                            />
                          )}
                        </p>
                      </button>

                      {emoji && (
                        <button
                          type="button"
                          className="absolute -bottom-1 -right-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEmoji(null);
                          }}
                        >
                          <Cross2Icon className="w-4 h-4 p-0.5 bg-white rounded-full shadow-md border border-gray-200 text-gray-400" />
                        </button>
                      )}
                    </div>
                  </Popover.Trigger>
                </div>

                <Popover.Portal>
                  <Popover.Content className="" side="bottom" sideOffset={5}>
                    <div className="relative z-50">
                      <Picker
                        data={data}
                        onEmojiSelect={(e: Emoji) => {
                          console.warn("emoji", e);
                          setEmoji(e);
                          setIsEmojiPickerOpen(false);
                        }}
                        theme="light"
                        previewPosition="none"
                      />
                      <Popover.Arrow className="fill-gray-200" />
                    </div>
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            </div>

            <div className="flex flex-row gap-6 justify-end mt-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!(name.isValid && desc.isValid)}
                className=" text-gray-600 hover:text-gray-700 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Create waypoint
              </button>

              <Dialog.Close asChild>
                <button className="text-red-400 hover:text-red-500 transition-colors">
                  Cancel
                </button>
              </Dialog.Close>
            </div>
          </div>
        </div>

        <Dialog.Close asChild>
          <button
            className="absolute top-7 right-9 w-6 h-6 text-gray-500 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X strokeWidth={1.5} />
          </button>
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  );
};

export default CreateWaypointDialog;
