import dotenv from "dotenv";
import Users from "../../models/Users";
import NewUsersSequence, {
  SequenceStatus,
} from "../../models/NewUsersSequence";
import { v4 } from "uuid";
import { sequence1 } from "../mails/newUsers/sequence1";
import { sequence2 } from "../mails/newUsers/sequence2";
import { sequence3 } from "../mails/newUsers/sequence3";
import { Op } from "sequelize";
import logger from "../../logger";

dotenv.config();
export const newUserSequence = async () => {
  logger.info("Running newUserSequence...");
  try {
    //   if (process.env.ENV === "production") {
    const unsubscribedUsers = await Users.findAll({
      where: {
        subscriptionName: null,
      },
    });

    logger.info(`${unsubscribedUsers.length} unsubscribed users found`);
    for (const user of unsubscribedUsers) {
      const userInSequence = await NewUsersSequence.findOne({
        where: { user_id: user.id },
      });

      if (!userInSequence) {
        logger.info(`Sending sequence 1 to: ${user.email}`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await sequence1(user.email, user.firstName, user.id);
        logger.info(`Creating new sequence for user: ${user.email}`);
        await NewUsersSequence.create({
          id: v4(),
          email: user.email,
          user_id: user.id,
          first_sequence: {
            date: new Date(),
            status: SequenceStatus.SENT,
          },
        });
      } else if (userInSequence.first_sequence.status !== SequenceStatus.SENT) {
        logger.info(`Sending sequence 1 to: ${user.email}`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await sequence1(user.email, user.firstName, user.id);
      } else if (
        new Date(userInSequence.second_sequence.date).toDateString() ===
          new Date().toDateString() &&
        userInSequence.second_sequence.status !== SequenceStatus.SENT
      ) {
        logger.info(`Sending sequence 2 to: ${user.email}`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await sequence2(user.email, user.firstName, user.id);
        await NewUsersSequence.update(
          {
            second_sequence: {
              date: new Date(),
              status: SequenceStatus.SENT,
            },
          },
          { where: { user_id: user.id } }
        );
      } else if (
        new Date(userInSequence.second_sequence.date).toDateString() === new Date().toDateString() &&
        userInSequence.third_sequence.status !== SequenceStatus.SENT
      ) {
        logger.info(`Sending sequence 3 to: ${user.email}`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await sequence3(user.email, user.firstName, user.id);
        await NewUsersSequence.update(
          {
            third_sequence: {
              date: new Date(),
              status: SequenceStatus.SENT,
            },
          },
          { where: { user_id: user.id } }
        );
      }
    }
    //   }
  } catch (error: any) {
    logger.error(error, 'Error in newUserSequence');
    return;
  }
};
