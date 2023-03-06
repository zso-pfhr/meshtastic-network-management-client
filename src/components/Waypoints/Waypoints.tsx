import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Marker } from "react-map-gl";
import moment from "moment";

import type { Waypoint } from "@bindings/protobufs/Waypoint";

import { deviceSliceActions } from "@features/device/deviceSlice";
import { selectActiveWaypointID } from "@features/device/deviceSelectors";

import WaypointIcon from "@app/components/Waypoints/WaypointIcon";

// This component returns a marker for each individual waypoint. It is called from MapView.tsx
interface IWaypoints {
  currWaypoint: Waypoint;
}

const Waypoints = ({ currWaypoint }: IWaypoints) => {
  const dispatch = useDispatch();
  const activeWaypointID = useSelector(selectActiveWaypointID());

  const expired = currWaypoint.expire < moment().valueOf() / 1000; // Boolean

  const handleClick = () => {
    console.log();
    dispatch(deviceSliceActions.setActiveWaypoint(currWaypoint.id));
  };

  return (
    <div className="">
      <Marker
        latitude={currWaypoint.latitudeI / 1e7}
        longitude={currWaypoint.longitudeI / 1e7}
        anchor="center"
        onClick={handleClick}
      >
        <WaypointIcon
          isSelected={currWaypoint.id === activeWaypointID}
          expired={expired}
        ></WaypointIcon>
      </Marker>
    </div>
  );
};

export default Waypoints;
