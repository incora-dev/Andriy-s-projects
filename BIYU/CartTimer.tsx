import { Text } from '@components/text';
import { SECONDS_IN_MINUTE } from '@models/info.model';
import { DEFAULT_TIMER_DURATION, Order, ORDER_ABANDON_TIME } from '@models/order/order.model';
import { useAppDispatch } from '@store';
import { selectOrderTimer, setOrderTimer } from '@store/order/orderSlice';
import { Color } from '@styles/colors';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

export const CartTimer = forwardRef(({ onTimeLeft, order }: { onTimeLeft?: () => void; order: Order }, ref) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  // stored remaining order time in Redux
  const remainOrderTime = useSelector(selectOrderTimer);
  // stores remaining time in seconds
  const [timeLeft, setTimeLeft] = useState(remainOrderTime);
  // dividing remaining time on minutes and seconds
  const minutesLeft = Math.floor(timeLeft / SECONDS_IN_MINUTE);
  const secondsLeft = Math.floor(timeLeft - minutesLeft * SECONDS_IN_MINUTE);

  let countInterval: any;
  // allows update timer from other components
  useImperativeHandle(ref, () => ({
    setTimer: (value?: number) => {
      dispatch(setOrderTimer(!!value && value > 0 ? value : 0));
    },
  }));

  const updateTimer = () => {
    clearInterval(countInterval);
    countInterval = setInterval(() => {
      // counting and setting remaining time each second

      const millisecondsLeft: number = ORDER_ABANDON_TIME - (Date.now() - Date.parse(order.updatedDate));
      setTimeLeft(millisecondsLeft > 0 ? millisecondsLeft / 1000 : 0);
      if (millisecondsLeft <= 0) {
        if (onTimeLeft) {
          onTimeLeft();
        }
        clearInterval(countInterval);
      }
    }, 1000);
  };

  useEffect(() => {
    updateTimer();
    return () => {
      dispatch(setOrderTimer(ORDER_ABANDON_TIME));
      clearInterval(countInterval);
    };
  }, [order]); // eslint-disable-line

  const getTimerDisplay = () => {
    if (timeLeft === ORDER_ABANDON_TIME) return 'Loading...';
    return `${t('product_is_reserved')}: ${minutesLeft < DEFAULT_TIMER_DURATION ? `0${minutesLeft}` : minutesLeft}:${
      secondsLeft < DEFAULT_TIMER_DURATION ? `0${secondsLeft}` : secondsLeft
    }`;
  };

  return (
    <Text.H3 color={Color.Gray} style={{ textAlign: 'center' }}>
      {getTimerDisplay()}
    </Text.H3>
  );
});
