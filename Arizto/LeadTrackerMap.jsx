import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { connect } from 'react-redux';
import { withHeader } from '../../../hocs';
import { HeaderAnimated, LeadTrackerPropertyMap } from '../../../components';

import { text } from '../../../content';
import { Navigation } from '../../../shapes';
import { screenHelper } from '../../../helpers';

import styles from './styles';
import { leadTrackerActions } from '../../../modules/leadTracker';

const RefreshScrollView = screenHelper.renderRefreshView();

const LeadTrackerMap = ({ navigation, screenProps, dispatchActions, propertyItems, propertyFilters }) => {
  const locationCard = navigation.getParam('locationCard', {});
  const useDeviceLocation = navigation.getParam('useDeviceLocation', false);
  const [filteredPropertyItems, setFilteredPropertyItems] = useState(propertyItems);

  useEffect(() => {
    setFilteredPropertyItems(propertyItems.filter(item => propertyFilters.includes(item.status)));
  }, [propertyFilters, propertyItems]);

  useEffect(() => {
    return () => {
      dispatchActions?.removePropertyItems();
    };
  }, [dispatchActions]);

  return (
    <View style={styles.mapContainer}>
      <LeadTrackerPropertyMap
        filteredDots={filteredPropertyItems}
        screenProps={screenProps}
        RefreshScrollView={RefreshScrollView}
        minZoomLevel={6}
        maxZoomLevel={19}
        toolbarEnabled
        showsBuildings={true}
        showsPointsOfInterest={false}
        showsTraffic={false}
        showsIndoors={false}
        containerStyle={styles.mapView}
        locationCard={locationCard}
        useDeviceLocation={useDeviceLocation}
      />
    </View>
  );
};

LeadTrackerMap.propTypes = {
  navigation: Navigation.isRequired,
};

const LeadTrackerMapScreen = withHeader(
  LeadTrackerMap,
  <HeaderAnimated useNavigationSafeAreaView title={text.text_leadTracker} hasBack />,
  { showMenuOnBack: true },
);

const mapStateToProps = ({ leadTracker }) => ({
  propertyItems: leadTracker.propertyItems,
  propertyFilters: leadTracker.propertyFilters,
});

const mapDispatchToProps = dispatch => ({
  dispatchActions: {
    removePropertyItems: () => dispatch(leadTrackerActions.removePropertyItems()),
  },
});

export default connect(mapStateToProps, mapDispatchToProps)(LeadTrackerMapScreen);
