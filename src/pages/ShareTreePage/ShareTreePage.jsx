import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import style from './ShareTreePage.module.scss';
import rightButton from '@/assets/swiper-button/right.png';
import leftButton from '@/assets/swiper-button/left.png';

import messageContext from '@/contexts/messageContext';
import flowerContext from '@/contexts/flowerContext';

import Header from '@/components/Header/Header';
import OriginTree from '@/components/OriginTree/OriginTree';
import LongButtonList from '@/components/LongButtonList/LongButtonList';
import HamburgerButton from '@/components/HamburgerButton/HamburgerButton';
import SideMenu from '@/components/SideMenu/SideMenu';
import MessageList from '@/components/MessageList/MessageList';
import MessageDetail from '@/components/MessageDetail/MessageDetail';
import { db, useCallCollection } from '@/firebase/app';
import {
  collection,
  doc,
  endBefore,
  getCountFromServer,
  getDocs,
  limit,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  startAfter,
} from 'firebase/firestore';
import classNames from 'classnames';
import Flower from '@/components/Flower/Flower';
import ModalProjectInfo from '@/components/ModalProjectInfo/ModalProjectInfo';
import Notification from '@/components/Notification/Notification';
import { useSignOut } from '@/firebase/auth/useSignOut';

const ShareTreePage = () => {
  const [messageListVisible, setMessageListVisible] = useState(false);
  const [messageDetailVisible, setMessageDetailVisible] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [flowerInfo, setFlowerInfo] = useState({});
  const [modal, setModal] = useState(false);

  const { uid } = useParams();
  const listBackgroundRef = useRef();
  const messageListRef = useRef();
  const messageDetailRef = useRef();
  const navigate = useNavigate();
  const location = useLocation();

  const messageVisibility = useMemo(
    () => ({
      messageListVisible,
      setMessageListVisible,
      messageDetailVisible,
      setMessageDetailVisible,
    }),
    [
      messageListVisible,
      setMessageListVisible,
      messageDetailVisible,
      setMessageDetailVisible,
    ]
  );

  // 공유 트리 페이지의 주인
  const [userNickname, setUserNickname] = useState('');
  const [bgSrc, setBgSrc] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [flowerList, setFlowerList] = useState([]);
  const [renderList, setRenderList] = useState([]);
  const [lastVisible, setLastVisible] = useState(null);
  const [pageTotalCount, setPageTotalCount] = useState(0);
  const [hasPrevPage, setHasPrevPage] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(true);

  const preventGoBack = () => {
    history.pushState(null, '', location.href);
  };

  useLayoutEffect(() => {
    getPageTotalCount();
    queryPage(7, 'next');
  }, []);

  useLayoutEffect(() => {
    setHasNextPage(flowerList.length === pageTotalCount ? false : true);
    setHasPrevPage(flowerList.length <= 7 ? false : true);
  }, [flowerList.length, pageTotalCount]);

  const flowerListRef = collection(db, `users/${uid}/flowerList`);

  const getPageTotalCount = async () => {
    const res = await getCountFromServer(
      query(flowerListRef, orderBy('createAt', 'asc'))
    );

    setPageTotalCount(res.data().count);
  };

  const queryPage = async (limitCount = 10, text) => {
    let q;
    if (!lastVisible) {
      q = query(flowerListRef, orderBy('createAt', 'asc'), limit(limitCount));
    } else {
      let updateCount = flowerList.length - 7;
      q = query(
        flowerListRef,
        orderBy('createAt', 'asc'),
        text === 'next' ? startAfter(lastVisible) : endBefore(lastVisible),

        limit(
          text === 'next'
            ? limitCount
            : updateCount <= limitCount
            ? limitCount
            : updateCount
        )
      );
    }

    const docSnapshot = await getDocs(q);

    if (isLoading) {
      setIsLoading(false);
    }

    const docs = docSnapshot.docs;
    queryData(docs, text);
  };

  const queryData = (docs, text) => {
    const listItem = [];

    docs.forEach((doc) => {
      listItem.push({ id: doc.id, ...doc.data() });
    });

    const updateList =
      text === 'next' ? [...flowerList, ...listItem] : listItem;
    setFlowerList(updateList);
    setRenderList(listItem.slice(-7, undefined));

    let nextDoc = docs[docs.length - 1];
    if (nextDoc) setLastVisible(nextDoc);
  };

  // 로그인 한 사용자
  const localUid = JSON.parse(localStorage.getItem('uid'));
  const [localNickname, setLocalNickname] = useState('');

  const handleMenuClick = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const notification = (className) => {
    const CopyNotification = document.querySelector(`.${className}`);
    CopyNotification.classList.add(style.animateNotification);
    setTimeout(() => {
      CopyNotification.classList.remove(style.animateNotification);
    }, 4000);
  };

  const handleCopyLink = () => {
    let url = `https://localhost:3000${location.pathname}`;
    navigator.clipboard.writeText(url);
    notification('targetCheckLinkCopyNotification');
  };

  const handleOpenMessageDetail = (messageVisibility, message) => {
    const backgroundElement = messageDetailRef.current;
    setFlowerInfo(message);

    if (uid !== localUid) {
      notification('targetCheckOwnerNotification');
      return;
    } else if (!msgActive) {
      notification('targetCheckPeriodNotification');
      return;
    }

    if (!messageDetailVisible) {
      backgroundElement.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
      backgroundElement.style.display = 'block';
      backgroundElement.style.zIndex = 102;

      setMessageDetailVisible(!messageDetailVisible);
    }
  };

  const handleOpenMessageList = (e, messageVisibility) => {
    const backgroundElement = listBackgroundRef.current;
    const messageListElement = messageListRef.current;

    if (!msgActive) {
      notification('targetCheckPeriodNotification');
      return;
    }

    if (!messageListVisible) {
      messageListElement.classList.add(style.moveIn);
      backgroundElement.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
      backgroundElement.style.display = 'block';
      backgroundElement.style.zIndex = 101;

      setMessageListVisible(!messageListVisible);
      setTimeout(() => {
        messageListElement.classList.remove(style.moveIn);
      }, 900);
    }
  };

  const handleCreateMessage = () => {
    if (!active) {
      notification('targetCheckCreatableNotification');
    } else {
      navigate(`/message-custom/${uid}`);
    }
  };

  const { signOut } = useSignOut();

  const handleWatchTree = () => {
    if (localUid) {
      window.location.replace(`/share-tree/${localUid}`);
    } else {
      alert('로그인이 필요합니다.');
      signOut();
      localStorage.clear();
      navigate('/');
    }
  };

  const handleModal = () => {
    setModal(!modal);
  };

  const today = new Date();
  const [msgActive, setMsgActive] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'users', uid), (doc) => {
      setUserNickname(doc.data().userNickname);
      setBgSrc(doc.data().bgSrc);
    });

    useCallCollection('users').then((userList) => {
      userList.map((user) => {
        if (user.uid === localUid) {
          setLocalNickname(user.userNickname);
        }
      });
    });

    const msgStartDate = new Date(today.getFullYear(), 3, 15); // 4월 15일
    const msgEndDate = new Date(today.getFullYear(), 3, 29); // 4월 29일
    const isMsgActive = today >= msgStartDate && today <= msgEndDate;
    setMsgActive(isMsgActive);

    const startDate = new Date(today.getFullYear(), 2, 15); // 3월 15일
    const endDate = new Date(today.getFullYear(), 3, 14); // 4월 14일
    const isActive = today >= startDate && today <= endDate;
    setActive(isActive);

    history.pushState(null, '', location.href);
    window.addEventListener('popstate', preventGoBack);

    return () => {
      window.removeEventListener('popstate', preventGoBack);
    };
  }, []);

  return (
    <>
      <messageContext.Provider value={messageVisibility}>
        <flowerContext.Provider value={{ flowerInfo, setFlowerInfo }}>
          <div
            style={{
              background: `url(${bgSrc}) center / cover no-repeat `,
            }}
            className={style.shareTreeContainer}
          >
            <Header
              userName={userNickname}
              subText={`${pageTotalCount}송이의 벚꽃이 피었어요 ! `}
            />
            <div className={style.blossomTreeContainer}>
              {isLoading ? (
                <div>Loading...</div>
              ) : (
                <div className={style.flowerList}>
                  <div className={style.originTreeContainer}>
                    <OriginTree />
                    {renderList.map((item) => (
                      <Flower
                        uid={uid}
                        item={item}
                        handleOpenMessageDetail={handleOpenMessageDetail}
                      />
                    ))}
                  </div>
                  <span className={style.pagination}>
                    {flowerList.length}/{pageTotalCount}
                  </span>
                  <div className={style.swiperButton}>
                    <button
                      type="button"
                      className={classNames(
                        style.arrowButton,
                        style.leftButton
                      )}
                      disabled={!hasPrevPage}
                      onClick={() => queryPage(7, 'prev')}
                    ></button>
                    <button
                      type="button"
                      className={classNames(
                        style.arrowButton,
                        style.rightButton
                      )}
                      disabled={!hasNextPage}
                      onClick={() => queryPage(7, 'next')}
                    ></button>
                  </div>
                </div>
              )}
            </div>
            <div className={style.notificationContainer}>
              <Notification
                className={classNames(
                  'targetCheckOwnerNotification',
                  style.notificationStyling
                )}
                text={'나의 벚꽃나무만 확인이 가능합니다 !'}
              />

              <Notification
                className={classNames(
                  'targetCheckPeriodNotification',
                  style.notificationStyling
                )}
                text={'아직 벚꽃 열람 시기가 아니에요 !'}
              />

              <Notification
                className={classNames(
                  'targetCheckLinkCopyNotification',
                  style.notificationStyling
                )}
                text={'링크가 복사되었습니다 !'}
              />

              <Notification
                className={classNames(
                  'targetCheckCreatableNotification',
                  style.notificationStyling
                )}
                text={'작성기한이 마감되었습니다 !'}
              />
            </div>

            {uid === localUid ? (
              <LongButtonList
                firstText={'링크 공유하기'}
                firstClick={handleCopyLink}
                secondText={'전체 메세지 보기'}
                secondClick={(e) => handleOpenMessageList(e, messageVisibility)}
              />
            ) : active ? (
              <LongButtonList
                firstText={'벚꽃 달아주기'}
                firstClick={handleCreateMessage}
                secondText={'내 벚꽃나무 보러가기'}
                secondClick={handleWatchTree}
              />
            ) : (
              <LongButtonList
                firstText={'벚꽃 달아주기'}
                firstClick={handleCreateMessage}
                secondText={'내 벚꽃나무 보러가기'}
                secondClick={handleWatchTree}
              />
            )}
            <div onClick={handleMenuClick}>
              <HamburgerButton />
            </div>
            {isMenuOpen && (
              <SideMenu handleModal={handleModal} loginName={localNickname} />
            )}
          </div>

          <MessageList
            flowerList={flowerList}
            listBackgroundRef={listBackgroundRef}
            messageListRef={messageListRef}
            handleOpenMessageDetail={handleOpenMessageDetail}
          />
          <MessageDetail
            flowerInfo={flowerInfo}
            messageDetailRef={messageDetailRef}
          />
        </flowerContext.Provider>
      </messageContext.Provider>
      {modal ? <ModalProjectInfo handleModal={handleModal} /> : null}
    </>
  );
};

export default ShareTreePage;
