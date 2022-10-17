/* eslint-disable react-hooks/exhaustive-deps */
import React, { useRef, useEffect, useContext, useState, useCallback } from 'react';
import { withNavigation } from 'react-navigation';
import { View, Platform, Animated } from 'react-native';
import MapView from 'react-native-map-clustering';
import { connect } from 'react-redux';
import { PERMISSIONS, request, RESULTS } from 'react-native-permissions';
import PropTypes from 'prop-types';
import { Marker } from 'react-native-maps';

import Geolocation from 'react-native-geolocation-service';
import NavigationService from '../../../config/navigation_service';
import { general, screens, types } from '../../../constants';
import { TriangleDotsIcon, ThreeDotsIcon } from '../../Icons';
import { metrics, colors } from '../../../themes';
import { ConfirmModal, CustomButton, Refresh, Spinner } from '../..';
import { Navigation } from '../../../shapes';
import ThemeContext from '../../../contexts/ThemeContext';
import { text } from '../../../content';
import deviceActions from '../../../modules/device/device_actions';
import { leadTrackerActions } from '../../../modules/leadTracker';
import { openLocationPermissionDeniedAlert } from '../../../modules/device/device_saga';
import { toastMessageActions } from '../../../modules/toastMessage';

import styles, { darkStyle, disableMapPoi } from './styles';
import useDimensions from '../../../hooks/useDimensions';

const START_ZOOM_LEVEL = 18;
const MIN_AUTOREFRESH_ZOOM_LEVEL = 17.2;

const deg2rad = deg => {
  return deg * (Math.PI / 180);
};

const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1); // deg2rad below
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
};

const checkPermissionStatus = () => {
  return new Promise(resolve => {
    request(
      Platform.select({
        android: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        ios: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
      }),
    )
      .then(permissionStatus => {
        resolve(permissionStatus === RESULTS.GRANTED);
        if (permissionStatus !== RESULTS.GRANTED) {
          openLocationPermissionDeniedAlert();
        }
      })
      .catch(error => console.error(error));
  });
};

const LeadTrackerPropertyMap = ({
  screenProps,
  RefreshScrollView,
  dispatchActions,
  children,
  containerStyle,
  deviceCoordinates,
  filteredDots,
  multipoints,
  navigation,
  locationCard,
  useDeviceLocation,
  ...rest
}) => {
  const { themeMode, theme } = useContext(ThemeContext);
  const { effectiveWidth } = useDimensions();
  const refMapView = useRef(null);
  const userMarkerRef = useRef(null);
  const [mapLoader, setMapLoader] = useState(false);
  const [pointsLoader, setPointsLoader] = useState(false);
  const [showUserLocation, setShowUserLocation] = useState(false);
  const [isHideModalVisible, setIsHideModalVisible] = useState(false);
  const [lastScreenLocation, setLastScreenLocation] = useState(
    deviceCoordinates?.latitude && deviceCoordinates?.longitude
      ? { lat: deviceCoordinates?.latitude, long: deviceCoordinates?.longitude }
      : null,
  );
  const [deviceCoordinatesTaken, setDeviceCoordinatesTaken] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(START_ZOOM_LEVEL);
  const [minClusterZoomLevelWasReached, setMinClusterZoomLevelWasReached] = useState(false);

  const [devicePermissionGranted, setDevicePermissionGranted] = useState(false);
  const [cardId, setCardId] = useState(locationCard?.id || null);
  const [visible, setIsVisible] = useState(locationCard?.isVisible, null);

  useEffect(() => {
    screenProps.setHeaderActions(renderThreeDots);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    renderThreeDots,
    useDeviceLocation,
    JSON.stringify(deviceCoordinates),
    cardId,
    JSON.stringify(locationCard),
    visible,
  ]);

  useEffect(() => {
    // added for Android navigate to user location fix
    if (deviceCoordinates?.latitude && !deviceCoordinatesTaken) {
      animateToUserLocation(deviceCoordinates?.latitude, deviceCoordinates?.longitude, null);
      getPoints({ lat: deviceCoordinates?.latitude, long: deviceCoordinates?.longitude });
      setDeviceCoordinatesTaken(true);
    }
    if (deviceCoordinates?.latitude && !lastScreenLocation) {
      setLastScreenLocation({ lat: deviceCoordinates?.latitude, long: deviceCoordinates?.longitude });
    }
  }, [deviceCoordinates]);

  const navigateToLocationMenuModal = () => {
    NavigationService.navigate(screens.locationMenuModal, {
      showTrackingThisArea: cardId === null && useDeviceLocation,
      showRenameTrack: cardId !== null,
      showFetchArea: true,
      visible,
      onAddLocation: () => {
        const { latitude, longitude } = refMapView?.current?.__lastRegion;
        if (latitude && longitude) {
          NavigationService.navigate(screens.locationNameModal, {
            isCreation: true,
            modalTitle: text.text_add_location,
            latitude,
            longitude,
            onSuccessCallback: newLocationCardData => {
              navigation.setParams({ locationCard: newLocationCardData });
              setCardId(newLocationCardData?.id);
            },
          });
        } else {
          dispatchActions.addToastMessage(
            text.text_lead_tracker_unable_to_get_your_location,
            types.toastMessageType.ERROR,
          );
        }
      },
      onRename: () => {
        // rename track
        NavigationService.navigate(screens.locationNameModal, {
          isCreation: false,
          modalTitle: text.text_lead_tracker_rename_track,
          id: cardId,
          currentName: locationCard?.name,
        });
      },
      onChangeHide: () => {
        setIsHideModalVisible(true);
      },
      onViewPropertyList: navigateToPropertyList,
      onCurrentLocationClicked,
      onFetchAreaProperty: fetchAreaProperty,
    });
  };

  const renderThreeDots = useCallback(() => {
    return (
      <CustomButton onPress={navigateToLocationMenuModal}>
        <ThreeDotsIcon size={metrics.$unitTwoPointFive} fill={colors.$transparent} />
      </CustomButton>
    );
  }, [cardId, useDeviceLocation, JSON.stringify(deviceCoordinates), JSON.stringify(locationCard), visible]);

  const navigateToPropertyList = () =>
    NavigationService.navigate(screens.propertyListModal, {
      locationCardId: cardId,
      locationCardCoordinates: locationCard?.coordinates,
    });

  const getPoints = async ({ lat, long, isInitialRequest = false }) => {
    const updateLoader = () => {
      if (isInitialRequest) {
        setMapLoader(false);
      } else {
        setPointsLoader(false);
      }
    };

    if (lat && long) {
      if (isInitialRequest) {
        setMapLoader(true);
      } else {
        setPointsLoader(true);
      }

      dispatchActions?.getPropertyItems(
        {
          lat: parseFloat(lat),
          long: parseFloat(long),
        },
        {
          onSuccess: () => updateLoader(),
          onFailed: () => updateLoader(),
        },
      );
    }
  };

  const fetchAreaProperty = () => {
    const { latitude, longitude } = refMapView?.current?.__lastRegion;
    getPoints({ lat: latitude, long: longitude });
    animateToUserLocation(latitude, longitude, currentZoom >= START_ZOOM_LEVEL ? null : START_ZOOM_LEVEL);
  };

  const onMapReady = async () => {
    if (useDeviceLocation) {
      navigateToCurrentGeolocation(true);
    } else {
      const latitude = locationCard?.coordinates?.lat;
      const longitude = locationCard?.coordinates?.long;
      getPoints({ lat: latitude, long: longitude, isInitialRequest: true });
      setLastScreenLocation({ lat: latitude, long: longitude });
      animateToUserLocation(latitude, longitude, START_ZOOM_LEVEL);
    }
  };

  const animateToUserLocation = (lat, long, zoomLevel) => {
    if (!refMapView && !refMapView.current && !lat?.longitude && !lat?.longitude) {
      return;
    }
    const newCamera = {
      center: {
        latitude: parseFloat(lat),
        longitude: parseFloat(long),
      },
      heading: 0,
      pitch: 0,
      altitude: 5,
    };
    if (zoomLevel) {
      newCamera.zoom = zoomLevel;
    }

    refMapView.current.animateCamera(newCamera, { duration: 100 });
    userMarkerRef.current?.showCallout();
  };

  const onCurrentLocationClicked = () => {
    setShowUserLocation(true);
    if (devicePermissionGranted && !!deviceCoordinates?.latitude) {
      animateToUserLocation(deviceCoordinates?.latitude, deviceCoordinates?.longitude);
    } else {
      navigateToCurrentGeolocation(false);
    }
  };

  const navigateToCurrentGeolocation = async isInitialRequest => {
    const permissionGranted = await checkPermissionStatus();
    setDevicePermissionGranted(permissionGranted);
    if (permissionGranted) {
      dispatchActions.getDeviceCoordinates();
      Geolocation.getCurrentPosition(
        position => {
          const {
            coords: { latitude, longitude },
          } = position;
          getPoints({ lat: latitude, long: longitude, isInitialRequest });
          animateToUserLocation(latitude, longitude, isInitialRequest ? START_ZOOM_LEVEL : null);
        },
        error => {
          // todo: sentry error or toast message
          console.log(error.code, error.message);
        },
        { enableHighAccuracy: true, timeout: 15000 },
      );
    }
  };

  const onUserLocationChange = data => {
    if (
      devicePermissionGranted &&
      !!deviceCoordinates?.latitude &&
      getDistanceFromLatLonInKm(
        deviceCoordinates?.latitude,
        deviceCoordinates?.longitude,
        data.nativeEvent.coordinate.latitude,
        data.nativeEvent.coordinate.longitude,
      ) > general.defaultSearchPropertiesRadius
    ) {
      dispatchActions.getDeviceCoordinates();
    }
  };

  const onRegionChangeComplete = data => {
    const { latitude, longitude, longitudeDelta } = data;
    // round to 0.5
    const zoom = Math.round(2 * (Math.log(360 / longitudeDelta) / Math.LN2)) / 2;
    setCurrentZoom(zoom);
    // prevent cluster disappear after first time it should be enabled
    if (zoom < MIN_AUTOREFRESH_ZOOM_LEVEL && !minClusterZoomLevelWasReached) {
      setMinClusterZoomLevelWasReached(true);
      animateToUserLocation(latitude, longitude);
    }

    // check drag distance
    if (
      getDistanceFromLatLonInKm(latitude, longitude, lastScreenLocation?.lat, lastScreenLocation?.long) >
        general.defaultSearchPropertiesRadius &&
      zoom > MIN_AUTOREFRESH_ZOOM_LEVEL
    ) {
      setLastScreenLocation({ lat: latitude, long: longitude });
      getPoints({ lat: latitude, long: longitude });
    }
  };

  const getPinBackGroundColor = point => {
    let backgroundColor = colors.$grey;
    if (multipoints?.includes(point?.id)) {
      backgroundColor = colors.$purple;
    } else {
      switch (point.status) {
        case text.text_unvisited:
          backgroundColor = colors.$grey;
          break;
        case text.text_tracked:
          backgroundColor = colors.$primary;
          break;
        case text.text_booked:
          backgroundColor = colors.$purple;
          break;
      }
    }
    return backgroundColor;
  };

  const handleToggleHidePress = () => {
    dispatchActions.toggleHideShowLocationCard(cardId, !visible, {
      onSuccess: show => {
        setIsVisible(show);
        dispatchActions.addToastMessage(
          show ? text.text_tracked_unarchived_successfully : text.text_tracked_archived_successfully,
          types.toastMessageType.SUCCESS,
        );
      },
      onFailed: () => {
        dispatchActions.addToastMessage(text.text_default_error, types.toastMessageType.ERROR);
      },
    });
  };

  return (
    <View style={styles.container}>
      <MapView
        onMapReady={onMapReady}
        showsUserLocation={useDeviceLocation || showUserLocation}
        onUserLocationChange={onUserLocationChange}
        onRegionChangeComplete={onRegionChangeComplete}
        ref={refMapView}
        provider="google"
        customMapStyle={themeMode === 'dark' ? darkStyle : disableMapPoi}
        style={styles.map}
        radius={effectiveWidth / 5}
        minPoints={10}
        clusteringEnabled={currentZoom < MIN_AUTOREFRESH_ZOOM_LEVEL}
        initialRegion={
          deviceCoordinates?.latitude && deviceCoordinates?.longitude
            ? {
                ...deviceCoordinates,
                latitudeDelta: 0,
                longitudeDelta: 0,
              }
            : general.DEFAULT_MAP_REGION
        }
        {...rest}
      >
        {filteredDots?.map(
          point =>
            // avoiding null coords
            point?.coordinates?.lat &&
            point?.coordinates?.long && (
              <Marker
                key={point?.id}
                onPress={() => {
                  if (multipoints?.includes(point?.id)) {
                    NavigationService.navigate(screens.propertyListModal, {
                      propertyId: point?.id,
                      locationCardId: cardId,
                    });
                  } else {
                    NavigationService.navigate(screens.leadTrackerInfoScreen, {
                      propertyId: point?.id,
                      locationCardId: cardId,
                    });
                  }
                }}
                coordinate={{
                  latitude: parseFloat(point?.coordinates?.lat) || parseFloat(point?.coordinates?.latitude),
                  longitude: parseFloat(point?.coordinates?.long) || parseFloat(point?.coordinates?.longitude),
                }}
                tracksViewChanges={false}
              >
                <View style={[styles.propertyPoint, { backgroundColor: getPinBackGroundColor(point) }]} />
              </Marker>
            ),
        )}
      </MapView>
      <View style={styles.mapLegendButtonContainer}>
        <CustomButton
          onPress={() => NavigationService.navigate(screens.mapLegendModal)}
          style={[styles.mapLegendButton, { backgroundColor: theme.background }]}
        >
          <TriangleDotsIcon size={metrics.$unitTwo} fill={colors.$grey} />
        </CustomButton>
      </View>
      <View style={styles.refreshButtonContainer}>
        <CustomButton
          onPress={fetchAreaProperty}
          style={[styles.refreshButton, { backgroundColor: theme.background }]}
          disabled={mapLoader || pointsLoader}
        >
          {mapLoader || pointsLoader ? <Spinner /> : <Refresh />}
        </CustomButton>
      </View>
      <ConfirmModal
        title={`${visible ? text.text_archive : text.text_unarchive}`}
        subTitle={visible ? text.text_archive_tracked_lead_warning : text.text_unarchive_tracked_lead_warning}
        confirmText={text.text_confirm}
        customConfirmButtonStyles={styles.deleteButtonStyles}
        onConfirm={() => setIsHideModalVisible(false)}
        onCancel={() => setIsHideModalVisible(false)}
        onModalHide={isConfirm => {
          if (isConfirm) handleToggleHidePress();
        }}
        visible={isHideModalVisible}
      />
    </View>
  );
};

LeadTrackerPropertyMap.propTypes = {
  navigation: Navigation.isRequired,
  dispatchActions: PropTypes.shape({
    getPropertyItems: PropTypes.func,
    getDeviceCoordinates: PropTypes.func,
    addToastMessage: PropTypes.func,
    addLocationCard: PropTypes.func,
    editLocationCard: PropTypes.func,
  }).isRequired,
  useDeviceLocation: PropTypes.bool.isRequired,
};

const mapStateToProps = ({ device, leadTracker }) => ({
  deviceCoordinates: device.coordinates,
  multipoints: leadTracker.multipoints,
});

const mapDispatchToProps = dispatch => ({
  dispatchActions: {
    getPropertyItems: (params, callback) => dispatch(leadTrackerActions.getPropertyItems(params, callback)),
    editLocationCard: data => dispatch(leadTrackerActions.editLocationCard(data)),
    addToastMessage: (data, type) => dispatch(toastMessageActions.addToastMessage(data, type)),
    getDeviceCoordinates: () => dispatch(deviceActions.getDeviceCoordinates()),
    addLocationCard: (data, callback) => dispatch(leadTrackerActions.addLocationCard(data, callback)),
    toggleHideShowLocationCard: (id, hidden, callback) =>
      dispatch(leadTrackerActions.toggleHideShowLocationCard(id, hidden, callback)),
  },
});

export default connect(mapStateToProps, mapDispatchToProps)(withNavigation(LeadTrackerPropertyMap));
