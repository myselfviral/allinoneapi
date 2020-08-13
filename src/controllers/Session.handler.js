import { Sessions } from '../entities/Sessions';

export const showAllSessions = async (req, res, next) => {
  try {
    const allsessions  = await Sessions.find()
    res.status(200).json(allsessions);
  } catch (err) {
    next(err);
  }
};

export const showOneUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const onesession = await Sessions.findOne({
      where: { id }
    });
    if (!onesession) {
      throw new Error(`session List doesn't exist`);
    }
    res.status(200).json(onesession);
  } catch (err) {
    next(err);
  }
};

export const createNewSession = async (req, res, next) => {
  try {
    const session = Sessions.create(req.body);
    await session.save();
    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const session = await Sessions.findOne({
      where: { id }
    });
    session.Reputation = req.body.Reputation;
   
    await session.save();
    res.status(200).json(session);
  } catch (err) {
    next(err);
  }
};

/* export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user: Users = await Users.findOne({
      where: { id },
      relations: ['comments']
    });
    await user.remove();
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
}; */
