import { Spacing } from '@styles/colors';
import React, { FunctionComponent, useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from '@styles/profile-styles';
import { InboundType, Order, OrderDetail, OutboundType } from '@models/order/order.model';
import { useSelector } from 'react-redux';
import { selectOrder, setOrderData } from '@store/order/orderSlice';
import { Failed } from '@models/order/order.functions';
import { useQuery } from '@apollo/client';
import { GetOrderQuery, MyFirstOrderQuery } from '@models/order/order.queries';
import { useAppDispatch } from '@store';
import { SimpleProductDefinition } from '@models/product/product-definition.model';
import { selectUserState } from '@store/user/userSlice';
import { Availabilities } from '@models/product/product-availability.model';
import {
  GetAvailableInboundSlots,
  GetNextAvailabilitiesForProductDefinitionId,
} from '@models/product/product-availability.functions';
import { DayDateString } from '@models/info.model';
import SlotPicker, { SlotPickerType } from '../SlotPicker/SlotPicker';
import { DeliveryOptionsSelector } from '../deliveryOptions';

type Props = {
  update: (order: { outboundType?: OutboundType; inboundType?: InboundType }) => void;
  selectedReturn: any;
  setSelectedReturn: any;
  slotsLoading?: boolean;
  pickupOnly: any;
  deliveryOnly: any;
};

export const SlotSelection: FunctionComponent<Props> = ({
  update,
  selectedReturn,
  setSelectedReturn,
  slotsLoading,
  pickupOnly,
  deliveryOnly,
}) => {
  const dispatch = useAppDispatch();
  const stateOrder = useSelector(selectOrder);
  const order = stateOrder && !Failed(stateOrder) ? stateOrder : null;
  const hub = order?.schedule.hub;
  const userState = useSelector(selectUserState);
  const [outBoundAvailabilities, setOutBoundAvailabilities] = useState<Availabilities[]>([]);
  const [inBoundAvailabilities, setInBoundAvailabilities] = useState<Availabilities[]>([]);
  const [selectedDelivery, setSelectedDelivery] = useState<OutboundType>(
    stateOrder?.outboundType || OutboundType.BiyuOutbound
  );
  const productDefinitionIds: string = JSON.stringify(
    order?.schedule.productDefinitions.map((d: SimpleProductDefinition) => d.id) ?? []
  );
  const { data: firstOrderQueryRes } = useQuery<{ myFirstOrder: boolean }>(MyFirstOrderQuery(order?.id), {
    fetchPolicy: 'network-only',
  });
  const { loading } = useQuery<{ order: OrderDetail }>(GetOrderQuery(stateOrder?.id as any, true), {
    fetchPolicy: 'no-cache',
    nextFetchPolicy: 'no-cache',
    errorPolicy: 'ignore',
    pollInterval: 5000,
    skip: !stateOrder || !userState.data,
    onCompleted: data => {
      if (data?.order) {
        dispatch(setOrderData(data.order));
      }
    },
  });
  const [updating, setUpdating] = useState<{ saving: boolean; error?: Error }>({ saving: false });

  const getDeliveryTimes = useCallback(async () => {
    if (!order) return;

    try {
      const outboundResp = await GetNextAvailabilitiesForProductDefinitionId(order?.schedule);
      const filteredOutBoundAvailabilities = outboundResp?.length
        ? outboundResp?.map(av => {
            return {
              ...av,
              slots: av.slots.filter(
                s =>
                  (order?.outboundType === OutboundType.BiyuOutbound ? s.deliveryPickupSlot : s.openingHourSlot) &&
                  s.count > 0
              ),
            } as Availabilities;
          })
        : [];
      setOutBoundAvailabilities(filteredOutBoundAvailabilities);

      const filteredInBoundAvailabilities = order?.id ? (await GetAvailableInboundSlots(order?.id, hub?.id)) ?? [] : [];

      const sortedAvailabilities: Availabilities[] = [];
      filteredInBoundAvailabilities
        .filter(s => (order?.inboundType === InboundType.BiyuInbound ? s.deliveryPickupSlot : s.openingHourSlot))
        .filter(s => !s.closed)
        .forEach(slot => {
          const existing = sortedAvailabilities.find(a => a.date.substring(0, 10) === slot.start.substring(0, 10));
          if (existing) {
            existing.slots.push(slot);
          } else {
            sortedAvailabilities.push({ date: slot.start, name: DayDateString(slot.start), slots: [slot] });
          }
        });
      setInBoundAvailabilities(sortedAvailabilities);
    } catch (err) {
      console.log('🚀 ~ file: deliveryTime.tsx ~ line 154 ~ getDeliveryTimes ~ err', err, productDefinitionIds);
    }
  }, [order, productDefinitionIds]); //eslint-disable-line

  useEffect(() => {
    if (productDefinitionIds) {
      getDeliveryTimes();
    }
  }, [getDeliveryTimes, productDefinitionIds]);

  const modify = async (o: Order) => {
    setUpdating({ saving: true });
    try {
      await update(o);
      setUpdating({ saving: false });
      return true;
    } catch (error: any) {
      console.warn(error);
      setUpdating({ saving: false, error });
    }
    return false;
  };

  if (!order) {
    return <></>;
  }

  return (
    <SafeAreaView style={styles.safeAreaView} edges={['right', 'top', 'left']}>
      <ScrollView>
        <View style={{ flex: 1, paddingBottom: Spacing.base }}>
          <View style={styles.container}>
            <DeliveryOptionsSelector
              hub={hub}
              order={order}
              memberOnly={pickupOnly}
              biyuOnly={deliveryOnly}
              loading={loading || updating.saving}
              update={update}
              selectedDelivery={selectedDelivery}
              setSelectedDelivery={setSelectedDelivery}
              selectedReturn={selectedReturn}
              setSelectedReturn={setSelectedReturn}
              deliveryType={SlotPickerType.start}
            />
          </View>
          <SlotPicker
            loading={loading || updating.saving || slotsLoading}
            pickDate={date => modify({ ...order, schedule: { ...order?.schedule, startDate: date, returnDate: '' } })}
            availabilities={outBoundAvailabilities}
            pickerType={SlotPickerType.start}
            freePickup={firstOrderQueryRes?.myFirstOrder}
          />
          <View style={styles.container}>
            <DeliveryOptionsSelector
              hub={hub}
              order={order}
              memberOnly={pickupOnly}
              biyuOnly={deliveryOnly}
              loading={loading || updating.saving}
              update={update}
              selectedDelivery={selectedDelivery}
              setSelectedDelivery={setSelectedDelivery}
              selectedReturn={selectedReturn}
              setSelectedReturn={setSelectedReturn}
              deliveryType={SlotPickerType.return}
            />
          </View>
          <SlotPicker
            loading={loading || updating.saving || slotsLoading}
            pickDate={date => modify({ ...order, schedule: { ...order?.schedule, returnDate: date } })}
            availabilities={inBoundAvailabilities}
            pickerType={SlotPickerType.return}
            freePickup={firstOrderQueryRes?.myFirstOrder}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
